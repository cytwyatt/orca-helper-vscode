# ORCA 6 Helper for VS Code

[English](./README.md) | **简体中文**

专为 **ORCA 6**（6.0 / 6.1）打造的 VS Code 一体化量子化学插件，提供输入文件语法智能提示、输出大纲目录、交互式 3D 分子/优化轨迹/振动动画预览，以及收敛曲线与 IR / UV-Vis 光谱分析。完全离线运行（内置 `3Dmol.js` 与 `Chart.js`，无任何外部 CDN 依赖），完美兼容 **Remote-SSH**。

---

## 核心功能

### 1. ORCA 6 输入文件（`.inp`）语言智能
- **语法高亮**：区分 `!` 简单关键词（泛函、3c 组合方法、基组、色散、任务类型、溶剂模型）、`%block ... end`、嵌套子块、`* xyz` / `* xyzfile`、幽灵原子（`Element :`）与 `$new_job`。
- **上下文自动补全**：
  - `!` 行：常用 ORCA 6 泛函、基组、积分格点（`DEFGRID1/2/3`）、任务类型（含 `GOAT`、`NEB-TS`、`OptTS`、`ESD`、`VPT2` 等），以及 `CPCM(...)` / `SMD(...)` / `ALPB(...)` 溶剂名补全。
  - `%` 行：自动插入常用 `%block` 模板（`%scf`、`%geom`、`%basis`、`%tddft`、`%freq`、`%cpcm`、`%neb`、`%goat`、`%mdci`、`%casscf`、`%rel` 等），并在块内提示专属参数与默认值。
  - `*` 行：补全 `* xyz` / `* xyzfile` / `* int` / `* gzmt`。
- **悬停文档（Hover）**：
  - 悬停关键词 / `%block` / 参数查看 ORCA 6 说明。
  - **悬停坐标行直接显示 0-based ORCA 原子序号**（编写 `%geom Constraints / Scan` 非常省心），同时显示 1-based 序号、原子序数、质量、坐标与幽灵原子状态。
- **实时语法诊断**：
  - 检查未闭合 `%block` / 子块、多余 `end`、未闭合 `* xyz`、非法坐标行、未知元素、缺失的 `* xyzfile` 文件；
  - 自动校验**总电子数与电荷/自旋多重度的奇偶一致性**（自动排除幽灵原子电子数）；
  - 检测过近原子接触（可配置阈值，默认 `< 0.5 Å`）；
  - 提示已废弃的 ORCA 4 旧关键词（如 `Grid4` / `Grid5` / `FinalGrid6` → 建议改用 `DEFGRID2` / `DEFGRID3`）。
- **代码片段与模板**：内置 `orca-opt-freq`、`orca-sp`、`orca-tddft`、`orca-optts`、`orca-goat`、`orca-scan`、`orca-neb`、`orca-basis-ecp` 等代码片段，并支持命令一键插入模板。

### 2. 输出解析、大纲目录与离线 3D / 图表分析面板
支持 `.inp`、`.out` / `.orcaout` / `.log`（自动识别 ORCA 文件头）、`.xyz` / `*_trj.xyz`、`.hess`、`.engrad`：

- **ORCA 6 侧边栏（Activity Bar）**：
  - **ORCA Outline / TOC**：一键跳转优化循环、能量、轨道、原子电荷、偶极矩、频率、光谱、热力学和报错行。
  - **Job Summary**：状态、ORCA 版本、分子式、电荷/多重度、最终能量、优化步数与收敛状态、虚频数、HOMO–LUMO 能隙、偶极矩、Gibbs 自由能与运行时间。
  - **ORCA Workspace Files**：快速浏览工作区内的 ORCA 文件（自动排除 `node_modules`、`.git` 与 Slurm 日志目录）。
- **3D 结构与轨迹视图（`3Dmol.js`）**：
  - 支持 **Ball & Stick / Stick / CPK Sphere / Wireframe** 切换，支持按元素或 **Mulliken / Loewdin / Hirshfeld** 电荷着色。
  - 自动识别 **BSSE 幽灵原子**（半透明青色独立渲染，可一键开关）与 **ECP 原子**。
  - **点击测距 / 键角 / 二面角**（依次点击 2 / 3 / 4 个原子）。
  - **优化轨迹 / Scan 轨迹播放**：帧滑块、变速播放（`0.5x`–`4x`）、循环、相对能量（`ΔE`）、跳转到文本对应行、一键复制当前帧为 ORCA `* xyz` 块、导出 `.xyz` 或保存 PNG 截图。
  - 支持叠加显示**偶极矩箭头**与 `.engrad` **梯度矢量箭头**。
- **收敛曲线、振动动画与光谱（`Chart.js`）**：
  - 几何优化能量曲线（支持 `kcal/mol`、`kJ/mol`、`Eh`，**点击曲线上任意一步联动跳转 3D 帧**）、梯度/步长对数收敛图与最新 SCF 收敛图。
  - 振动频率表（高亮虚频）+ **点击任意频率直接在 3D 视图中播放简正振动动画**（可调振幅、速度与位移矢量箭头）。
  - 交互式洛伦兹展宽 **IR 光谱**与高斯展宽 **TD-DFT UV-Vis 光谱**。

---

## 支持的文件格式

| 扩展名 | 支持功能 |
| :--- | :--- |
| `.inp` | 语法高亮、自动补全、悬停提示（含 0-based 原子序号）、代码片段、实时诊断、大纲、3D 预览 |
| `.out`, `.orcaout`, `.log` | 自动识别 ORCA 输出高亮、大纲目录、任务摘要、3D 优化轨迹、收敛图、轨道、电荷、频率与振动动画、IR / UV-Vis 光谱、热力学 |
| `.xyz`, `*_trj.xyz`, `.trj`, `.allxyz` | 单帧与多帧 3D 轨迹播放（含 ORCA Scan `.allxyz`、NEB/IRC 轨迹）、自动提取能量绘制曲线、快捷键控制（`Space` / `←` / `→`） |
| `.hess` | 几何结构（自动 Bohr → Å 换算）、振动频率、3D 简正振动动画（`◀`/`▶` 模式切换、矢量箭头、导出 20 帧动画 `.xyz`）、模拟 IR 光谱 |
| `.engrad` | 几何结构（自动 Bohr → Å 换算）、总能量、3D 核梯度矢量箭头 |

---

## 快捷操作

1. 打开任意 `.inp` / `.out` / `.xyz` / `.hess` / `.engrad` 后，点击编辑器右上角的 **预览图标** 或右下角状态栏的 **`ORCA 6: ...`** 即可打开 3D 与分析面板。
2. 点击编辑器右上角 **切换关联文件图标**（`ORCA 6: Switch Between Related Files`），在同名的 `.inp` / `.out` / `_trj.xyz` / `.xyz` / `.hess` / `.engrad` 之间一键跳转。
3. 命令面板（`Ctrl+Shift+P` / `Cmd+Shift+P`）输入 **`ORCA 6: Insert Calculation Template`** 快速插入常用 ORCA 6 模板。

---

## 插件配置项

| 配置项 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `orcaHelper.autoDetectInputLanguage` | `true` | 打开包含 ORCA 语法的 `.inp` 文件时自动切换为 ORCA Input（与 Packmol 等其他 `.inp` 插件和平共存）。 |
| `orcaHelper.autoDetectOutputLanguage` | `true` | 打开包含 ORCA 文件头的 `.out`/`.log` 时自动启用 ORCA Output 语法高亮。 |
| `orcaHelper.defaultRepresentation` | `"ballstick"` | 3D 视图默认显示模式（`ballstick`、`stick`、`sphere`、`line`）。 |
| `orcaHelper.showGhostAtoms` | `true` | 默认以半透明标记显示 BSSE 幽灵原子。 |
| `orcaHelper.shortContactThreshold` | `0.5` | `.inp` 原子过近接触警告阈值（Å）。 |
| `orcaHelper.irBroadeningFwhm` | `20` | 模拟 IR 光谱默认洛伦兹半高宽 FWHM（cm⁻¹）。 |
| `orcaHelper.uvBroadeningEv` | `0.3` | 模拟 TD-DFT UV-Vis 光谱默认高斯展宽（eV）。 |

---

## 安装方式

### 通过 VS Code 插件商店安装
在 VS Code 扩展视图（`Ctrl+Shift+X` / `Cmd+Shift+X`）中搜索 **`ORCA 6 Helper`**（`cytwyatt.orca-helper-vscode`），或访问 [VS Code 插件商店页面](https://marketplace.visualstudio.com/items?itemName=cytwyatt.orca-helper-vscode)，也可使用命令行一键安装：
```bash
code --install-extension cytwyatt.orca-helper-vscode
```

### 通过本地 `.vsix` 安装
```bash
code --install-extension orca-helper-vscode-0.1.0.vsix
```
或在 VS Code 扩展视图右上角 `...` → **Install from VSIX...** 选择 `.vsix` 文件。

---

## 本地开发

```bash
npm install
npm run typecheck
npm test
npm run compile
npm run package
```

架构说明与开发约定见 [AGENTS.md](./AGENTS.md)。

## 开源协议

[MIT](./LICENSE)
