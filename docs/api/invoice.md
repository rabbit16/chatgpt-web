# 发票（按充值订单开）· 后端接口契约

> 更新：2026-10-22 · 依据站长反馈：**发票必须对应具体充值订单，不能在任意页面随手开；一单只能开一次；入口放在支付记录里。**
> 前端代码：`src/request/invoice.ts`、`src/components/InvoiceApplyModal/`、`src/pages/shop/`（支付记录）、`src/pages/invoice/`（我的发票）、`src/pages/admin/invoices/`（审核）。
> 前端已按本契约实现并做了降级：接口未上线时不报错、不产生脏数据。

## 零、当前状态（2026-10-23 修订：留言通道已停用）

**后端尚未实现**：`POST /user/invoice/summary`、`/user/invoice/list`、`/user/invoice/create` 目前都返回 `{"detail":"Not Found"}`（已用测试账号实测）。

### ⚠️ 重要变更：不再往留言墙写开票申请

**问题**（站长实测反馈）：点「开发票」会往**公开留言墙**投一条实名消息。

**原因**：原设计是「专用接口不通 → 把整包申请写进 `POST /user/feedback`」当双保险。
但留言墙 `/notice?tab=feedback` 是**游客免登录可见**的，而开票申请含：

- 税号（企业抬头时必填）
- 收票邮箱
- 真实姓名 / 公司名

前端原本靠「内容以 `【发票申请】` 开头就过滤」兜底，但这只是**不渲染**：
1. 接口仍会把原始内容返回给任何调用者，数据已经出站；
2. 后端一旦在 content 前加包装（拼昵称、加空格），`startsWith` 失效，敏感内容直接显示在公开墙上。

**结论：隐私数据不能靠前端过滤保护，只能根本不写进去。**

**现在的行为**：

1. 只请求正式接口 `/user/invoice/create`；
2. 接口不存在 → 明确提示「发票申请通道暂未开通」，**不写任何留言**；
3. 接口返回业务错误（如「该订单已开过发票」）→ 如实透传 `codeMsg`。

用户填的表单**不会**落到留言墙，也不会在本地做假记录。

### 站长需要做的

按本文第一节起实现 `/user/invoice/*` 三个接口即可，前端无需再改：
`submitInvoiceApplication` 检测到 `code === 0` 就认为提交成功。

> 在接口上线前，用户看到的提示是「发票申请通道暂未开通，站长开通后即可在线提交」。
> 这比"假装收到"更诚实——也不会再产生泄露风险。

### 历史数据

此前通过留言通道提交过的申请仍在留言表里（以 `【发票申请】` 开头）。
后台「留言」页（`src/pages/admin/feedback/`）已识别该前缀并单独排版，老数据仍可处理；
公开留言墙对此类历史留言继续保持过滤显示。

## 一、三条硬规则（后端必须兜底）

1. **必须绑定订单**：申请时传 `bill_id`（`user_bill_list` 里的订单号），金额由后端按这笔订单取，**不信任前端传的金额**。
2. **一单一票**：同一 `user_id + bill_id` 只允许存在一张状态为 `pending / issuing / issued` 的发票；`rejected` 不算开出，允许用户重新申请。
3. **只能开自己的已支付订单**：校验订单属于当前 token 用户，且确实是一笔已支付的充值；余额消费、未支付、退款订单都不允许开。

## 二、鉴权与返回格式

- 与现有接口一致：请求头 `token: <登录 token>`。
- 成功：`{"code": 0, "codeMsg": "成功", "data": {...}}`（`code` 用数字或字符串 `"0"` 前端都认）。
- 失败：`{"code": 4006, "codeMsg": "该订单已开过发票"}`，前端直接展示 `codeMsg`。

## 三、需要改的账单接口（1 处）

`POST /user/user_bill_list`（支付记录）每条记录**建议增加两个字段**：

```json
{
  "bill_id": "1791363073531",
  "generate_time": "2026-10-07T16:51:22",
  "pay": 100.0,
  "function_name": "智能对话",
  "invoice_status": "issued",   // none / pending / issuing / issued / rejected
  "invoice_id": 12              // 没有发票时为 null
}
```

- 为什么加：支付记录表格要直接显示「开发票 / 待审核 / 已开票 / 已驳回」，避免前端每页再查一次发票列表。
- 前端兼容：**暂时没加也能跑**——前端会拉取用户发票列表，按 `bill_id` 自己对照；加了字段后优先用后端值。

## 四、用户端接口

### 1. 提交申请（核心改动）

`POST /user/invoice/create`

```json
{
  "bill_id": "1791363073531",
  "title_type": "company",
  "title": "上海某某科技有限公司",
  "tax_no": "91310000XXXXXXXXXX",
  "email": "boss@example.com",
  "remark": "抬头和上次一样"
}
```

- `bill_id` **必填**；`amount` / `order_no` 是旧字段，前端仍会带，后端应**忽略金额、以订单为准**。
- 向后兼容：旧前端只传 `amount` 不传 `bill_id` 时，建议直接拒绝（`4008 请从支付记录里选择订单开票`），避免又出现“随手开”。

后端校验顺序建议：

1. 登录有效，订单存在且属于当前用户 → 否则 `4005`；
2. 订单已支付且是充值订单 → 否则 `4007`；
3. 该订单没有 `pending / issuing / issued` 的发票 → 否则 `4006`；
4. 抬头、税号、邮箱格式合法 → 否则 `4008`；
5. 落库：`amount = 订单.pay`，状态 `pending`，写入 `bill_id`、`user_id`、`created_at`。

成功返回：`{"code": 0, "data": {"id": 12}}`

### 2. 我的申请列表

`POST /user/invoice/list`

```json
{ "page": 1, "page_num": 8, "status": "pending" }
```

```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 12,
        "bill_id": "1791363073531",
        "amount": 100.00,
        "title_type": "company",
        "title": "上海某某科技有限公司",
        "tax_no": "91310000XXXXXXXXXX",
        "email": "boss@example.com",
        "remark": "抬头和上次一样",
        "status": "issued",
        "invoice_no": "26XXXXXXXX",
        "reject_reason": null,
        "created_at": "2026-10-22 14:00:00",
        "updated_at": "2026-10-23 10:00:00"
      }
    ],
    "total": 1,
    "page": 1
  }
}
```

- 每张发票必须能查到对应 `bill_id`（旧数据没有就返回 `order_no`）。
- `pending / issuing` 可被用户撤销；`issued / rejected` 不可撤销。

### 3. 汇总（保留，供“我的发票”顶部数字）

`POST /user/invoice/summary`，请求体 `{}`：

```json
{
  "code": 0,
  "data": {
    "recharge_total": 370.00,
    "issued_amount": 100.00,
    "pending_amount": 0,
    "invoiceable_amount": 270.00
  }
}
```

> 若按订单开票后不再需要“可开金额”，这三个数字仍可用于展示，不影响主流程。

### 4. 撤销申请

`POST /user/invoice/cancel`，请求体 `{"id": 12}`；只允许 `pending / issuing`。

## 五、站长端接口

### 1. 审核列表

`POST /user/admin/invoice/list`

```json
{ "page": 1, "page_num": 10, "status": "pending", "userId": null }
```

返回结构同上，每条额外带 `user_id`、`user_name`、`bill_id`。后台表格已增加「订单号」列，并提示一单一票。

### 2. 审核

`POST /user/admin/invoice/review`

```json
{ "id": 12, "status": "issued", "invoice_no": "26XXXXXXXX" }
```

或：

```json
{ "id": 12, "status": "rejected", "reject_reason": "税号与抬头不一致，请核对后重新提交" }
```

- `issued` 必须带 `invoice_no`；`rejected` 必须带 `reject_reason`。
- 审核为 `issued` 时再次确认该 `bill_id` 没有其他有效发票（防止并发重复通过）。
- `rejected` 后该订单在用户端恢复「重新申请」按钮。

## 六、错误码约定（建议，前端只展示 `codeMsg`）

| code | 含义 | 用户看到 |
|---|---|---|
| 4001 | 未登录 / token 失效 | 自动跳登录 |
| 4003 | 非管理员 | 仅管理员可访问后台 |
| 4005 | 订单不存在或不属于当前用户 | 找不到这笔订单，请刷新支付记录 |
| 4006 | 订单已开票 / 审核中 | 该订单已开过发票，不能重复申请 |
| 4007 | 订单未支付 / 不是充值订单 | 只有已支付的充值订单可以开票 |
| 4008 | 参数不合法 | 请检查抬头、税号、邮箱 |

## 七、后端改动清单（可直接照着做）

- [ ] `user_bill_list` 每条增加 `invoice_status`、`invoice_id`（可选但推荐）。
- [ ] 新建发票表：`id, user_id, bill_id, amount, title_type, title, tax_no, email, remark, status, invoice_no, reject_reason, created_at, updated_at`。
- [ ] `user_id + bill_id` 加唯一约束（只约束有效状态；或代码里事务校验）。
- [ ] `/user/invoice/create`：按 `bill_id` 校验归属/已支付/未开票，金额取订单，写 `pending`。
- [ ] `/user/invoice/list`、`/summary`、`/cancel`。
- [ ] `/user/admin/invoice/list`、`/review`。
- [ ] 所有失败返回 `codeMsg`，前端直接展示。

## 八、前端降级与验收

- 接口 404 / 报错：支付记录「发票」列显示“开票服务未开通”，不出现可点的空按钮；“我的发票”显示空态。
- 接口就绪后验收：
  1. 支付记录里未开票订单显示「开发票」；
  2. 提交后该订单变「待审核」，再点提示已开过；
  3. 站长驳回后变「已驳回」，用户可「重新申请」；
  4. 站长通过后变「已开票」，不能再申请；
  5. 刷新、换设备后状态一致。
