# 菜单运行时故障检查与修复

检查日期：2026-10-08。应用版本：0.722.0，Electron 41.7.1，macOS arm64。
修复分支：`codex/quality-audit-remediation`。

## 结论与提交

| 问题                                  | 根因与修改                                                                                                                                                                                                                                                                              | 提交       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Options、Load File 等菜单点击无响应   | 上一轮共享版本算法的修改在沙箱 preload 中直接 `require('semver')`。Electron 拒绝加载该 npm 模块，导致整个 preload 失败，IPC 桥接未建立；GenomeBrowser 初始化随后失败并重试，重复绑定的下拉按钮处理器连续打开和关闭菜单。将 semver 运算放回主进程，经专用同步 IPC 保留现有插件解析 API。 | `b9a15950` |
| 启动时 BLAST 本地数据库列表报权限错误 | 沙箱的 home 路径不可用，旧回退逻辑拼出了 `/tmp/Library/Application Support/GenomeAIStudio/blast/db`。改为在 BLAST 检测与数据库扫描之前，通过现有 `getAppPaths()` 获取应用 userData，使用其 `blast/db` 子目录；保留已加载基因组旁的数据库目录规则。                                      | `d052fa7e` |

第一项修复保留 `sandbox: true`、`contextIsolation: true` 和 `nodeIntegration: false`。
新的同步通道仅允许 compare、validRange、satisfies 三种纯内存运算，校验参数个数、字符串类型及长度，不暴露通用 sendSync，也不执行文件或网络操作。非法版本错误仍传回调用方。

此前静态和单元测试未覆盖沙箱 preload 的实际加载约束，`npm start` 创建窗口也不足以证明页面完成初始化。本次通过真实窗口重现和修复后交互验证补足这一缺口。

## Computer use 实际验证

通过 computer use 操作本分支 `npm start` 启动的 Electron 窗口，读取 accessibility tree、截图和 DevTools；并非检查其他已安装版本。

| 入口                                      | 已观察到的结果                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Options                                   | 点击后显示下拉菜单，重复点击可收起                                                             |
| Configure LLM Providers                   | 配置窗口打开，取消退出                                                                         |
| Evo 2 DNA Generation                      | DNA Generation 面板打开，关闭退出                                                              |
| Agent Settings                            | 设置窗口打开，取消退出                                                                         |
| External MCP Servers                      | 服务器配置窗口打开，取消退出                                                                   |
| General Settings                          | 设置窗口打开，取消退出                                                                         |
| LLM Benchmark                             | Benchmark 界面打开，关闭退出                                                                   |
| Debug Tools                               | 调试工具窗口打开，关闭退出                                                                     |
| Load File → Genome File                   | 系统选择器打开；实际加载临时 FASTA，显示 `menu_smoke`、2,800 bp、GC 50.00%、序列面板和 GC 轨道 |
| Load File → Annotation File               | Open Annotation File 选择器打开，取消退出                                                      |
| Load File → Variant File                  | Open Variant File 选择器打开，取消退出                                                         |
| Load File → Reads File                    | Open Reads File 选择器打开，取消退出                                                           |
| Load File → WIG/BigWig Tracks             | Open Tracks File 选择器打开，取消退出                                                          |
| Load File → Operon File                   | Open Operon File 选择器打开，取消退出                                                          |
| Load File → Blast Results                 | Open Blast File 选择器打开，取消退出                                                           |
| Load File → Any Supported File            | Open File 选择器打开，取消退出                                                                 |
| Export As → Configure                     | 导出配置窗口打开，取消退出                                                                     |
| Advanced Search                           | 高级搜索窗口打开，关闭退出                                                                     |
| Tracks、Primers                           | 各自下拉菜单正常显示和收起                                                                     |
| BLAST                                     | 搜索窗口打开，取消退出                                                                         |
| macOS 原生 File → Load File → Genome File | IPC 路由到正确系统选择器，取消退出                                                             |
| macOS 原生 Options → General Settings     | IPC 路由到设置窗口，取消退出                                                                   |

重启后只有一个 Welcome 标签。DevTools 中不再出现 preload 加载失败、`module not found: semver`、`ipcRenderer is not defined` 或 BLAST 默认目录拒绝错误。
在 DevTools 中只读查看 `window.genomeBrowser.blastManager.config.localDbPath`，得到真实应用目录下的 `blast/db` 路径。

## 自动验证

- 新增 `test/integration/sandboxed-preload.test.js`：执行完整 preload，模拟沙箱仅允许 Electron 模块；验证文件/菜单 API 完整暴露、主进程 semver 桥接语义、非法输入和不暴露通用同步 IPC。
- 新增 `test/unit/blast-sandbox-path.test.js`：验证等待真实路径后才检测/扫描 BLAST、加载基因组后的目录优先级、主进程路径查询失败时不向伪造目录执行命令。
- 第一项修复后全量测试：191 个文件、2,300 项通过。
- 两项修复后全量测试：192 个文件、2,304 项通过。命令：`vitest run --maxWorkers=2`，使用 Node.js 22.23.3。
- 覆盖率 CI 后续发现 UIManager 单元测试遗留延迟初始化计时器，在 worker 关闭时触发 Vitest 未处理错误。测试现改为清除与用例无关的定时器；修复后 `vitest run --coverage --maxWorkers=2` 通过，192 个文件、2,304 项断言通过，无 worker 错误。
- 初次高并发全量运行有两项工具检索 benchmark 超过默认 5 秒时限；限制 worker 数后同一测试集全部通过，未修改断言或超时阈值。
- 全库 ESLint：0 错误，4 条既有 warning（轨迹准备脚本及 benchmark 编号测试）。`git diff --check` 通过。

## 验证范围

本次验证菜单展开、设置/工具界面打开、系统文件选择器以及 FASTA 文件实际加载。其他文件格式只验证入口，不声称已完成所有格式解析与导出、远程模型调用、在线 BLAST 或 DNA 生成。
没有保存设置、启动 benchmark、发送模型请求或执行基因组修改。

本地 MCP Bridge 的 `ws://localhost:3003/` 服务未运行，仍会显示连接失败；已有失效数据库记录也会产生文件缺失警告。这些没有阻断本次验证的菜单或文件加载。
测试结束时应用已重新启动到 Welcome，未保留测试序列在当前窗口中。
