# 后端接口文档（T17）

前端设计定稿后在此生成，交付给站长接入。前端不直接改后端，只维护契约与前端依赖字段。

## 计划结构

- `openapi.yaml`：OpenAPI 3.1，按域分组，可导入 Apifox / Postman
- `README.md`：Base URL、鉴权、响应包、分页、错误码、SSE、CORS
- `endpoints.md`：页面 → 接口 → 前端依赖字段
- `changes.md`：改版新增 / 变更 / 废弃接口
- `examples/`：curl、SSE、错误响应示例
- `mock/`：本地 mock 数据
- `review-checklist.md`：站长联调验收清单

## 状态

- 当前：待前端设计定稿
- 已有参考：`src/docs/usage-api.md`、`src/docs/vendor-pricing-api.md`（后续合并）
- 注意：`src/docs/openapi.yaml` 是另一个项目（Senior Voice API）的遗留文件，需归档/替换，不能当作本项目契约
