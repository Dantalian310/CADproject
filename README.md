# Cloud CAD 协同机械设计系统

这是“基于云的协同机械 CAD 系统设计与实现”的课程实验项目。当前工程采用 Vue 3 + TypeScript + Vite 前端、Spring Boot 后端、PostgreSQL 本地数据库，后续可部署到华为云 ECS。

## 工程结构

```text
frontend/   Vue 3 + TypeScript + Vite 前端
backend/    Spring Boot + PostgreSQL 后端
scripts/    本地开发、测试和 Git 辅助脚本
.local/     项目内 PostgreSQL 程序与数据目录，不上传 Git
.cache/     Maven 等本地缓存目录，不上传 Git
```

## 推荐 IDE

可以使用 Cursor 打开并修改这个项目。建议在 Cursor 中直接打开项目根目录：

```text
D:\Coding\CodexProject\CADproject
```

这样可以同时看到 `frontend`、`backend`、`scripts` 和设计文档。Cursor 适合本项目的全栈开发、代码阅读和 AI 辅助修改；如果后续需要更强的 Java 调试、重构和 Spring Boot 运行配置，也可以同时安装 IntelliJ IDEA Community 或 Ultimate。前端单独开发时，VS Code / Cursor 都可以。

建议安装的 Cursor / VS Code 扩展：

- Vue - Official
- TypeScript Vue Plugin
- ESLint
- Prettier
- Extension Pack for Java
- Spring Boot Extension Pack
- PostgreSQL 相关数据库查看插件

## 本地环境

当前工程默认使用：

- Node.js 18+
- npm 10+
- Java 17+
- Maven 3.9+
- 项目内 PostgreSQL 16.14，目录为 `.local/postgresql-16.14`

数据库默认连接信息：

```text
Host: 127.0.0.1
Port: 5432
Database: cloudcad
Username: cloudcad
Password: cloudcad_dev_password
```

前后端访问地址：

```text
前端页面: http://127.0.0.1:5173/
后端健康检查: http://127.0.0.1:8080/actuator/health
```

## 快速启动、停止与检查

推荐日常使用下面三条命令：

```powershell
scripts\dev\local-start.cmd
scripts\dev\local-status.cmd
scripts\dev\local-stop.cmd
```

分别对应：

| 操作 | 命令 | 说明 |
| --- | --- | --- |
| 启动全套服务 | `scripts\dev\local-start.cmd` | 按“数据库 -> 后端 -> 前端”启动，并等待后端健康检查和前端页面可访问 |
| 检查运行状态 | `scripts\dev\local-status.cmd` | 检查 `5432`、`8080`、`5173` 三个端口以及后端 `UP` 状态 |
| 停止全套服务 | `scripts\dev\local-stop.cmd` | 按“前端 -> 后端 -> 数据库”停止本项目服务 |

如果只想分别操作某一层：

| 服务 | 启动 | 停止 | 状态/验证 |
| --- | --- | --- | --- |
| PostgreSQL 数据库 | `scripts\dev\postgres-start.cmd` | `scripts\dev\postgres-stop.cmd` | `scripts\dev\postgres-status.cmd` |
| Spring Boot 后端 | `scripts\dev\backend-dev.cmd` | `scripts\dev\backend-stop.cmd` | 打开 `http://127.0.0.1:8080/actuator/health`，看到 `UP` 即正常 |
| Vue 前端 | `scripts\dev\frontend-dev.cmd` | `scripts\dev\frontend-stop.cmd` | 打开 `http://127.0.0.1:5173/`，能进入登录页即正常 |

## 首次准备

如果 `.local/postgresql-16.14` 已经存在，可以跳过 PostgreSQL 安装步骤。

```powershell
scripts\dev\postgres-install.cmd
scripts\dev\install-frontend.cmd
```

说明：

- `postgres-install.cmd` 会把 PostgreSQL 安装到当前项目的 `.local` 目录，避免占用额外 C 盘安装目录。
- `install-frontend.cmd` 会在 `frontend` 内安装 npm 依赖。
- 本地开发启动不要求预先执行 `backend-build.cmd`；`local-start.cmd` 会使用 Maven Spring Boot 开发模式启动后端。
- `backend-build.cmd` 用于部署前生成可执行 Spring Boot jar，执行前需要先停止本地后端，否则 Windows 会锁定 `backend\target\classes`。

## 启动顺序

推荐先使用一键本地启动脚本，它会按“数据库 -> 后端 -> 前端”的顺序启动服务，并把后端、前端放到后台运行。后端在本地开发时使用 `mvn spring-boot:run`，不依赖预先打好的 jar：

```powershell
scripts\dev\local-start.cmd
```

一键启动完成后，脚本会自动执行 `scripts\dev\local-status.cmd`。如果后端启动较慢，可以等待 10 秒后再次运行状态检查。

后台日志位置：

```text
.local\logs\backend.log
.local\logs\frontend.log
```

也可以手动分三个终端启动，便于开发时观察实时日志。

### 1. 启动数据库

```powershell
scripts\dev\postgres-start.cmd
scripts\dev\postgres-init-db.cmd
```

数据库启动后可以检查状态：

```powershell
scripts\dev\postgres-status.cmd
```

### 2. 启动后端

本地开发推荐使用 Maven 开发模式：

```powershell
scripts\dev\backend-dev.cmd
```

如果已经停止开发后端，并且执行过 `scripts\dev\backend-build.cmd` 生成部署 jar，也可以使用 jar 启动：

```powershell
scripts\dev\backend-run-jar.cmd
```

后端启动成功后访问：

```text
http://127.0.0.1:8080/actuator/health
```

正常结果应包含 `UP`。

### 3. 启动前端

```powershell
scripts\dev\frontend-dev.cmd
```

前端启动成功后访问：

```text
http://127.0.0.1:5173/
```

注意：`frontend-dev.cmd` 是前台运行脚本，必须保持这个终端窗口打开。关闭窗口或按 `Ctrl+C` 后，`http://127.0.0.1:5173/` 就会无法访问。

## 一键检查本地状态

如果页面打不开，先运行：

```powershell
scripts\dev\local-status.cmd
```

它会检查：

- PostgreSQL 是否监听 `127.0.0.1:5432`
- 后端是否监听 `8080`
- 后端健康检查是否返回 `UP`
- 前端是否监听 `127.0.0.1:5173`
- 前端页面是否返回 HTTP 200

## 常见问题

### 打不开 http://127.0.0.1:5173/

最常见原因是前端 Vite 开发服务没有运行，或启动前端的终端窗口已经被关闭。先运行：

```powershell
scripts\dev\local-status.cmd
```

如果 `Frontend 5173` 显示无法连接，说明前端服务没有监听端口。推荐直接启动全套本地服务：

```powershell
scripts\dev\local-start.cmd
```

也可以只启动前端：

```powershell
scripts\dev\frontend-dev.cmd
```

如果仍然打不开，检查端口：

```powershell
netstat -ano | findstr 5173
```

没有 `LISTENING` 表示前端服务没启动；有 `LISTENING` 但浏览器打不开时，优先尝试：

- 确认访问的是 `http://127.0.0.1:5173/`，不是 `https://127.0.0.1:5173/`
- 刷新浏览器缓存，或换一个浏览器测试
- 检查浏览器代理/VPN 是否拦截本地地址
- 查看 `.local\logs\frontend.log` 是否有 Vite 启动错误
- 运行 `scripts\dev\local-status.cmd` 查看完整状态

### 页面能打开，但登录、项目列表或保存失败

通常是后端或数据库没有启动。按顺序运行：

```powershell
scripts\dev\postgres-start.cmd
scripts\dev\postgres-init-db.cmd
scripts\dev\backend-dev.cmd
```

然后再刷新前端页面。

### 后端提示“jar 中没有主清单属性”

这个错误表示当前 `backend\target\cloudcad-backend-0.1.0-SNAPSHOT.jar` 不是可执行 Spring Boot jar，通常是旧的普通 Maven jar 残留造成的。日常本机开发不需要用这个 jar 启动，直接运行：

```powershell
scripts\dev\local-start.cmd
```

如果是为了部署而需要 jar，请先停止本地后端，再重新构建：

```powershell
scripts\dev\local-stop.cmd
scripts\dev\backend-build.cmd
scripts\dev\backend-run-jar.cmd
```

如果 Windows 提示无法停止 8080 端口上的 Java 进程，可以在任务管理器中结束对应 PID 后再执行 `backend-build.cmd`。不要在 `backend-dev.cmd` 或 `local-start.cmd` 启动的后端仍在运行时打部署包，否则 Maven 会因为 `target\classes\application.yml` 被锁定而失败。

## CAD 工作区基础操作

绘图：

- 顶部平面选择支持 `XY`、`XZ`、`YZ`，新绘制的草图实体会落在当前平面。
- 工具栏已按“视图、草图、约束、实体、编辑”分组，圆、矩形、立方体等创建入口都在对应下拉菜单中。
- 选择“线段”“矩形”或“圆”后，在视口中按下鼠标左键，拖动预览，松开后创建图元；创建完成后会自动回到“选择”工具。
- 打开工具栏“构造”复选框后，新绘制的线段、矩形、圆和圆弧会作为构造几何创建，以灰色虚线显示，用作辅助定位和参考。
- 选择“圆弧”后，先点击圆心，再按下并拖动确定起点到终点，松开后创建中心点圆弧。
- 工具栏“实体”菜单中的“立方体”“球体”“锥体”可以直接按参数创建三维实体；立方体/长方体输入长宽高，球体输入半径，锥体输入底面半径和高度。“切除”会打开弹窗，用草图轮廓拉伸出的刀具体从主体实体中移除材料。
- 矩形和圆可以在当前草图平面执行拉伸，XY 平面沿 Z 方向，XZ 平面沿 Y 方向，YZ 平面沿 X 方向。
- 工具栏可开关“网格”“对象”“角度”捕捉，并可选择 1 / 2 / 5 / 10 / 25 mm 网格尺寸和 15° / 30° / 45° / 90° 角度步长；按住 `Shift` 绘制或编辑时使用 0.1 mm 精细步长。
- 绘制或拖拽编辑时，鼠标靠近已有图元的端点、中点、角点、边中点、圆心或象限点，会优先吸附到该几何参考点。
- 视口中出现蓝色吸附标记时，表示当前落点已对齐到对应参考点；按住 `Alt` 可以临时关闭吸附和网格约束，进行自由落点。
- 绘制线段或拖拽线段端点时，开启角度捕捉后会按当前角度步长规整方向，并保留鼠标拖出的长度。
- 视口左上角会显示当前网格尺寸、对象捕捉和角度捕捉开关状态，便于确认当前绘制精度。
- 绘制预览时，左上角会动态显示线段长度、矩形宽高或圆半径。

编辑：

- 切换到“选择”，点击草图实体可以选中。
- 在空白区域按住鼠标左键拖拽可以框选多个草图实体。
- 按住 `Shift` / `Ctrl` 点击实体可以增量选择或取消选择。
- 拖动实体主体可以移动位置。
- 多选后拖动其中一个已选实体，可以批量移动整组选中实体。
- 拖动线段端点、矩形角点或圆边缘可以调整大小。
- 拖动圆弧端点可以调整起止角和半径，拖动圆弧中点可以调整半径。
- 右侧属性面板可以精确编辑线段端点、矩形位置/宽高、圆心和半径，并可切换实体显示状态和锁定状态。
- 右侧属性面板可以精确编辑圆弧圆心、半径、起始角和终止角。
- 选中单个线段、矩形、圆或圆弧后，视口右下角会显示尺寸输入面板，可直接输入线段端点/长度、矩形位置/宽高、圆心/半径或圆弧参数。
- 选中草图实体后，视口中会直接显示长度、宽高或半径尺寸标签。
- 右侧属性面板会显示测量摘要：线段显示长度/角度/坐标增量，矩形显示宽高/面积/周长，圆显示半径/直径/面积，圆弧显示圆心角/弧长/弦长。
- 多选草图实体后，右侧属性面板会显示实体数量、可见/锁定/构造数量、整体范围宽高、范围中心和曲线总长。
- `Delete` / `Backspace` 删除选中实体。
- `Ctrl+Z` 撤销，`Ctrl+Y` 或 `Ctrl+Shift+Z` 重做。
- `Ctrl+D` 复制选中草图实体，多选时会批量复制。
- `Esc` 取消当前绘制/框选/圆弧定心状态并清空选择，`Space` 清空当前选择。
- 常用建模快捷键：`S` 选择，`L` 线段，`R` 矩形，`C` 圆，`A` 圆弧，`D` 尺寸，`H` 水平，`V` 垂直，`T` 相切，`Q` 切换构造；`Shift+E` 拉伸，`Shift+U` 布尔加，`Shift+X` 布尔减。
- 常用视图快捷键：`F` 全图，`Shift+1` 正视，`Shift+5` 俯视，`Shift+7` 等轴。
- 工具栏“旋转”会围绕当前选择整体中心旋转选中草图实体，可输入自定义角度；弹窗打开后，视口会以蓝色临时轮廓实时预览旋转结果。
- 工具栏“水平镜像”“垂直镜像”会围绕当前选择整体中心创建镜像副本。
- 工具栏“按线镜像”会把当前多选中的第一条线段作为镜像轴，并为其他选中实体创建镜像副本。
- 工具栏“阵列”会创建矩形阵列副本，可输入列数、行数、X 间距和 Y 间距，适合快速生成规则孔位或重复轮廓；参数变化时会实时预览将要生成的副本位置。
- 工具栏“偏移”会按输入距离为选中的线段、矩形或圆创建等距副本；正值向线段左法线、矩形外侧或圆外侧偏移，负值反向或向内偏移，并在应用前实时预览。
- 选中同一草图下两条未锁定线段后，工具栏“圆角”会按输入半径修剪两条线并生成相切圆弧；工具栏“倒角”会按输入距离修剪两条线并生成连接线段，弹窗参数变化时会实时预览。
- 左侧对象树会列出草图实体和三维特征，点击草图实体可选中，即使实体已经隐藏也可以从对象树重新找回。
- 在对象树中按住 `Ctrl` 点击草图实体可以增量多选，按住 `Shift` 点击同一草图下的实体可以范围多选。
- 对象树实体行右侧提供显示/隐藏、锁定/解锁、普通/构造切换和删除按钮；锁定实体需要先解锁再删除。
- 对象树顶部提供“显示全部”和“解锁全部”快捷按钮，用于快速恢复复杂草图的编辑状态。
- 右侧属性面板可切换当前草图实体的“构造”状态；构造实体保留捕捉、约束、测量和编辑能力，但不会参与拉伸或切除生成三维实体。
- 在对象树中选中拉伸或切除特征后，可以在右侧属性面板修改名称、抑制状态、深度、位置和旋转。
- 在对象树中选中布尔特征后，可以在右侧属性面板切换“布尔加 / 布尔减”，并继续调整结果实体的位置和旋转。
- 在对象树或三维视口中选中立方体、球体、锥体、拉伸体或布尔结果后，可以拖拽移动实体；右侧属性面板可以精确修改实体坐标、旋转、尺寸、半径和高度。
- 在三维视口或左侧对象树中按住 `Ctrl` / `Shift` 点击三维特征，可以同时选中多个球体、立方体、锥体、拉伸体或布尔结果。
- 多选两个三维实体后，工具栏“布尔”菜单会按选择顺序执行布尔操作：第一个选中对象作为主体 A，第二个选中对象作为客体 B。
- “布尔加”会把两个实体合并成一个结果实体；“布尔减”执行标准 A-B，从主体 A 中减去与客体 B 重叠的体积，结果只保留被切后的主体。
- “实体 -> 切除”用于草图切除：选择主体实体、矩形或圆草图轮廓和切除深度后，系统会把草图轮廓沿其所在平面的法向拉伸为刀具体，再从主体实体中减去这部分体积。

约束：

- 选中草图实体后，工具栏“固定”会锁定实体几何，实体仍可选中查看，但不能通过视口拖拽改变位置或尺寸。
- 选中线段后，工具栏“水平”“垂直”会立即修正线段方向，后续拖拽和属性编辑也会保持该方向约束。
- 选中线段、矩形或圆后，工具栏“尺寸”会按当前实际尺寸添加尺寸约束；线段约束长度，矩形依次约束宽度和高度，圆约束半径。
- 多选两个圆后，工具栏“同心”会让第二个圆的圆心跟随第一个圆；“等半径”会让第二个圆的半径跟随第一个圆。
- 多选两条线段后，工具栏“平行”会让第二条线段保持与第一条线段相同方向，并保留第二条线段自身长度。
- 多选两条线段后，工具栏“垂直关系”会让第二条线段保持自身长度，并调整为与第一条线段垂直。
- 多选圆与线段后，工具栏“相切”会移动第二个实体，使线段与圆相切；多选两个圆时会移动第二个圆，使两个圆外切。
- 右侧属性面板会显示当前选中实体的约束列表，可直接修改尺寸值或删除约束。
- 已添加的尺寸约束会以蓝色标注线和尺寸标签常驻显示在草图画布中，固定、水平、垂直约束会以小标签显示在对应实体附近。
- 鼠标悬停在蓝色尺寸标签上会出现可点击热点，点击后可以直接输入新的尺寸值并驱动草图实体更新。

视图：

- 鼠标滚轮缩放视图。
- 鼠标中键平移视图。
- 鼠标右键旋转视图。
- 工具栏“视图”菜单提供俯视、正视、右视、等轴和全图。

导出：

- 工具栏 SVG 会下载当前 CAD 文档的二维草图文件，适合浏览器预览、课程报告配图或继续进入矢量编辑工具处理。
- 工具栏 DXF 会下载当前 CAD 文档的二维草图交换文件，单位按毫米输出；普通草图实体写入 SKETCH 图层，构造几何写入 CONSTRUCTION 图层。
- 工具栏 STL 和 GLB 会导出当前 CAD 文档的三维实体模型。STL 适合三维打印/网格交换，GLB 适合网页三维预览和通用 glTF 流程。
- 草图导出默认跳过隐藏实体，但会保留构造几何，便于把辅助定位线一并交给后续 CAD/CAM 软件参考。

项目管理：

- 项目 OWNER 可以在首页项目卡片中编辑项目名称和描述。
- 项目 OWNER 可以在成员窗口输入用户名或邮箱发送邀请；被邀请人必须在自己的项目列表中接受后，才会成为项目成员。
- 项目 OWNER 可以删除项目，删除前会弹出二次确认。
- 首页“模型文件”支持把之前下载到本地的 `.cloudcad` 系统模型文件上传回系统，也兼容旧版 `.json`。每次上传都会自动创建一个独立项目；一个模型文件对应一个项目，删除项目只会删除该项目内的模型文档。上传后系统会自动打开该模型，后续可以继续编辑、保存和再次下载。
- 首页“上传模型文件”还支持导入 STL、glTF/GLB 网格模型为可保存、可移动的 mesh 特征。STEP/DWG 当前浏览器版会给出转换提示，建议先转换为 STL 或 glTF/GLB，后续可接入服务端 OpenCascade/DWG 转换器。
- 工作台右上角“退出项目”和“退出登录”会在存在未保存修改时提示保存；可以选择保存并退出、直接退出或关闭弹窗继续编辑。

### 端口被占用

停止当前项目服务：

```powershell
scripts\dev\frontend-stop.cmd
scripts\dev\backend-stop.cmd
scripts\dev\postgres-stop.cmd
```

再重新按启动顺序运行。

## 停止本地服务

推荐使用一键停止脚本，它会按“前端 -> 后端 -> 数据库”的顺序停止当前项目服务：

```powershell
scripts\dev\local-stop.cmd
```

也可以分别停止：

```powershell
scripts\dev\frontend-stop.cmd
scripts\dev\backend-stop.cmd
scripts\dev\postgres-stop.cmd
```

如果某个服务是在终端前台运行，也可以在对应终端按 `Ctrl+C` 停止。

## 本轮 CAD 交互增强说明

- 三维实体多选：在三维视口中按住 `Ctrl` 点击球体、锥体、立方体等实体可增减选择；在空白处拖出选择框时，如果框内包含三维实体，会优先形成三维特征多选。
- 三维自由移动：选中立方体、球体、锥体、拉伸体或布尔结果后直接拖动，系统会沿当前视角的相机平面计算 XYZ 位移，不再限制在单一 XY/XZ/YZ 草图平面内。
- 三维旋转：选中三维实体后可在右侧属性面板直接输入 `旋转 X/Y/Z`；也可在视口中按住 `Alt` 拖动选中实体进行快速旋转，按住 `Shift+Alt` 拖动时会优先调整 X/Z 方向组合旋转。
- 布尔运算：工具栏已单独提供“布尔”菜单，只保留“布尔加”和“布尔减”。布尔加对应合并；布尔减对应标准 A-B，即从第一个选中的主体实体中减去第二个选中的工具实体。两个操作都必须先显式选中至少两个三维实体。
- 草图切除：工具栏“实体 -> 切除”会把矩形或圆草图轮廓按输入深度拉伸为刀具体，并从指定主体实体中移除材料。
- 装配功能：工具栏新增“装配”菜单，支持中心重合、X/Y/Z 中心对齐、Z 面贴合、轴向距离和固定/解除固定。装配约束会写入 CAD 快照的 `assemblies` 字段，随数据库保存和版本记录一起持久化。
- 三平面网格：视口会同时显示 XY、XZ、YZ 三个工作平面网格，并根据当前模型包围范围自动扩展网格尺寸，当前草图平面会以更高透明度显示。
- 模型文件管理：首页新增“模型文件”列表，展示当前账户可访问项目中的数据库文档，可打开、重命名、编辑内容介绍、下载 `.cloudcad` 系统模型文件，也可以把本地 `.cloudcad`、旧版 `.json`、STL、glTF/GLB 上传回数据库。上传时会自动创建独立项目，保证模型文件和项目一一对应。

## 本地构建与测试

前端构建：

```powershell
scripts\dev\frontend-build.cmd
```

后端构建：

```powershell
scripts\dev\backend-build.cmd
```

注意：后端构建是部署准备动作，不建议在本地后端已经运行时执行。`backend-build.cmd` 会先检查 8080 端口，如果检测到后端仍在运行，会要求先停止服务，避免 Windows 文件锁导致 Maven 构建失败。构建成功后，可执行 jar 位于：

```text
backend\target\cloudcad-backend-0.1.0-SNAPSHOT.jar
```

后端单元测试：

```powershell
cd backend
mvn test
```

数据库和接口冒烟测试：

```powershell
scripts\test\db-smoke.cmd
scripts\test\api-smoke.cmd
scripts\test\api-smoke.cmd -BaseUrl http://127.0.0.1:5173
scripts\test\ws-smoke.cmd
scripts\test\cad-geometry-smoke.cmd
```

这些脚本覆盖数据库结构、注册、登录、项目创建、成员邀请、CAD 文档保存、版本查询、版本恢复、版本冲突、WebSocket presence、operation 广播、CAD 几何内核、参数化立方体/球体/锥体、二维草图 SVG/DXF 导出、CAD 快捷键映射以及线段圆角/倒角。

## 依赖缓存位置

为了减少 C 盘占用：

- npm cache：`frontend/npm-cache`
- Maven local repository：`.cache/maven-repository`
- Docker PostgreSQL 数据：`.docker-data/postgres`
- 项目内 PostgreSQL：`.local/postgresql-16.14`
- 项目内 PostgreSQL 数据：`.local/pgdata`

## Git 远程仓库

当前未配置远程仓库。拿到仓库地址后：

```powershell
scripts\git\setup-remote.cmd <仓库地址>
```

日常拉取：

```powershell
scripts\git\pull-main.cmd
```

日常提交推送：

```powershell
scripts\git\push-current.cmd "提交说明"
```

更完整的 Git 上传、下拉和华为云 ECS 部署准备说明见：

```text
14-Git仓库与云服务器部署准备说明.md
```

## Docker 服务器部署

当前项目已补充 Docker Compose 部署方案，适合阿里云 ECS、华为云 ECS 或其他 Linux 云服务器。

核心文件：

- `docker-compose.yml`：生产部署编排，包含 PostgreSQL、Spring Boot 后端、Vue/Nginx 前端。
- `.env.example`：服务器环境变量模板，部署时复制为 `.env` 并填写真实密码和域名/IP。
- `backend/Dockerfile`：构建并运行后端 Spring Boot 服务。
- `frontend/Dockerfile` 与 `frontend/nginx/default.conf`：构建前端并通过 Nginx 代理 `/api` 和 `/ws`。
- `scripts/deploy/deploy.sh`：服务器拉取 GitHub 最新代码并重新构建容器。
- `scripts/deploy/backup-postgres.sh`：服务器数据库备份脚本。

服务器首次部署和后续更新流程见：

```text
16-Docker部署与服务器持续更新方案.md
```
