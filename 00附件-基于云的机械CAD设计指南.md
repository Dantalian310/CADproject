## 基于云的机械CAD设计指南

&#x20;

***

## 一、基本功能模块

### 🔧 2D/3D 建模核心

* 草图绘制：直线、圆弧、圆、样条曲线、约束（水平/垂直/相切/等长/同心）、尺寸标注与驱动

* 实体建模：拉伸、旋转、扫掠、放样、倒角、圆角、抽壳、布尔运算（并/交/差）

* 参数化设计：变量/方程式驱动、配置表（同一零件不同规格）、父子特征回溯与编辑

* 装配设计：零件插入、配合约束（重合/平行/垂直/同心/距离）、爆炸视图、干涉/碰撞检测

### 📐 工程图与数据

* 自动投影三视图/剖面图、智能尺寸标注（符合 GB 机械制图标准）、公差与表面粗糙度符号

* 自动生成 BOM（物料清单）、质量/重心/转动惯量计算

### ☁️ 云特性功能

* 多人实时协同：类似 Git 的版本树 + OT/CRDT 算法实现无冲突并发编辑，跟随模式评审

* 标准件库：GB/ISO/DIN 螺栓、轴承、电机等参数化标准件，支持用户自建库

* 格式互操作：导入/导出 STEP(.stp)、IGES、STL、Parasolid；解析/保存 DWG/DXF（2D）；支持 glTF 用于 Web 渲染

* 权限与流程：项目/文件夹 RBAC 权限、审签流程、分支/版本对比

### 🤖 可选进阶

* 轻量级 FEA（静力/模态初步校核）、运动仿真、与 PLM/ERP 对接 API

***

## 二、系统架构设计

推荐 云原生微服务 + Browser-Side Geometry Kernel（Wasm）​ 架构：

```
┌─────────────── 浏览器端 (Web Client) ───────────────┐
│  UI层(React/Vue+TS)                                 │
│  渲染引擎(Three.js/ Babylon.js + WebGL2)             │
│  几何内核(OpenCascade → Wasm/Emscripten)             │
│  协同客户端(WebSocket + CRDT/OT差分同步)              │
└───────────────────┬──────────────────────────────────┘
                    │ HTTPS / WSS
┌─────────────────── 云端(微服务) ─────────────────────┐
│  API Gateway → 鉴权(JWT/OAuth2)                     │
│  用户服务 / 项目管理 / 权限服务                      │
│  文件元数据服务 / 版本控制服务(Git-like DAG)         │
│  转换服务(C++ Worker: STEP↔STL↔glTF 格式转换)        │
│  仿真任务调度(Heavy FEA→提交K8s Job→结果回调)         │
│  消息推送(WebSocket/SSE 协同广播)                    │
└───────────────────┬──────────────────────────────────┘
  对象存储(OSS/S3/MinIO) — 模型文件/版本快照
  关系库(PostgreSQL)— 用户/项目/BOM/权限
  缓存(Redis)— Session/热点数据/锁
  K8s + Docker — 弹性伸缩、GPU节点供渲染/仿真
```

关键点：

* 几何计算尽量放前端 Wasm，减轻服务器压力并降低延迟；大装配或复杂仿真提交云端异步计算

* 数据以数据库记录存储特征树而非仅存 mesh，支持参数化回弹编辑（参考 Onshape 做法）

***

## 三、推荐技术栈与工具

| 层次      | 选型                                                             | 说明                              |
| :------ | :------------------------------------------------------------- | :------------------------------ |
| 前端框架​   | React + TypeScript 或 Vue3 + TS                                 | 组件化复杂 UI（工具栏/属性面板/特征树）          |
| 3D 渲染​  | Three.js / Babylon.js + WebGL2                                 | 硬件加速，支持大体量三角面显示                 |
| 几何内核​   | OpenCASCADE(OCCT) 编译为 Wasm，或用 CGAL.js                          | 工业级 B-Rep 建模，Emscripten 移植      |
| 2D 草图​  | 自研 SVG Overlay + 约束求解器（如 C++ 版 Eigen→Wasm 或 JS 版 dogleg 求解）    | 约束求解是难点需重点关注                    |
| 协同算法​   | Yjs(CRDT) 或 ShareDB(OT) + WebSocket                            | 实时无冲突同步特征树                      |
| 后端 API​ | Node.js(NestJS) 或 Java(Spring Boot) / Go(Gin)                  | 高并发协同比 Node 有优势，Java 偏企业级       |
| 格式解析​   | C++ 写转换 Worker → 暴露 gRPC/HTTP，或使用 ifcopenshell/OpenCascade CLI | STEP/DWG 解析                     |
| 数据库​    | PostgreSQL(含 PostGIS) + Redis                                  | PG 适合存储结构化 BOM/元数据              |
| 存储​     | 阿里云 OSS / AWS S3 / MinIO(自建)                                   | 加密存储版本快照                        |
| 部署​     | Docker + Kubernetes + Nginx/Envoy                              | CI/CD(GitLab CI/GitHub Actions) |
| 监控​     | Prometheus + Grafana + ELK                                     | 日志与性能追踪                         |

> 💡 若不想从零移植 OCCT，可评估商用 Web CAD SDK 如 MxCAD（DWG/DXF Web 端）、Autodesk Forge / ODA Web 组件（需注意授权）。

***

## 四、开发步骤（分阶段 MVP→完整版）

第一阶段：技术验证 MVP（2～3个月）

1. 搭建 React + Three.js 前端脚手架，实现基本立方体显示、旋转/缩放/平移

2. 优先使用 OpenCascade.js 验证 OCCT Wasm，在浏览器端完成简单拉伸或 Box - Sphere Cut，并渲染 mesh/GLB

3. 后端搭建用户登录 + 文件上传/下载（存 OSS），保存 OCCT B-Rep 或 STEP 原始数据

4. 实现最简单的草图（线段+圆）+ 尺寸驱动 → 重建实体

第二阶段：核心 CAD 功能（3～6个月）

1. 完善草图约束求解器（距离/角度/平行/垂直/相切）

2. 实体特征：旋转、扫掠、倒角圆角、抽壳、阵列（线性/圆周）

3. 装配基础：插入多零件 + 重合/同心配合，简单干涉检测

4. 工程图模块：三视图投影 + 尺寸标注（可先用 SVG 实现）

5. 版本控制：保存特征树快照，支持 Undo/Redo 和历史回溯

第三阶段：云协同与生态（持续迭代）

1. WebSocket + CRDT 接入，实现多人同时编辑同一 Document，显示光标/选区

2. 标准件参数化库、材质库

3. 格式导入导出（STEP/IGES/STL/glTF），后台转换 Worker

4. 轻量 FEA/运动仿真（提交云端计算任务）

5. 开放 REST API + Webhook，对接 PLM/ERP

6. 性能优化：LOD 大装配、视锥裁剪、InstancedMesh、WASM 多线程(SIMD)

***

## ⚠️ 关键风险与建议

* 几何内核与约束求解器是最难的部分，建议优先基于 OpenCascade（开源）或商业内核（Parasolid/Spatial ACIS 需授权），不要自写 B-Rep 内核

* 浏览器内存限制：万级零件装配需做轻量化（只下发显示 mesh + 懒加载 B-Rep），大装配建议云端预简化

* 协同冲突：特征树的 OT/CRDT 实现复杂，初期可先做"文件级锁定+版本分支"，再升级实时协同

* 合规方面注意 DWG 格式有 Autodesk 专利/授权限制，商业产品建议购买第三方库或回避直接读写 DWG

如果你需要，我可以进一步帮你细化 OpenCascade.js 技术验证步骤、草图约束求解器选型，或帮你画一份更详细的功能模块分解表。
