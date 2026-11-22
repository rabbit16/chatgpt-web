# 后端接口文档（T17）

这里记录交付给站长的接口约定和前端依赖字段。

最新交付见 [前端改版后端交接（2026-11-21）](后端交接-2026-11-21.md)，包括发布配置、现有接口依赖和联调清单。

后台三组接口（用户专属价 / 号商密钥 `protocol` / 软路由）的线上实测结论见
[后台接口线上核查（2026-11-22）](后端接口-线上核查-2026-11-22.md)：接口已在生产就绪，
仅管理端鉴权需站长确认手机号 vs sk- 的口径。

## 计划结构

- `openapi.yaml`：OpenAPI 3.1，按域分组，可导入 Apifox / Postman
- `README.md`：Base URL、鉴权、响应包、分页、错误码、SSE、CORS
- `endpoints.md`：页面 → 接口 → 前端依赖字段
- `changes.md`：改版新增 / 变更 / 废弃接口
- `examples/`：curl、SSE、错误响应示例
- `mock/`：本地 mock 数据
- `review-checklist.md`：站长联调验收清单

## 状态

- 当前交付：发布配置、页面接口约定和联调清单已整理，待部署环境核对。
- 已有参考：`src/docs/usage-api.md`、`src/docs/vendor-pricing-api.md`（后续合并）
- 注意：`src/docs/openapi.yaml` 是另一个项目（Senior Voice API）的遗留文件，需归档/替换，不能当作本项目契约
