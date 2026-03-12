# Case Dataset Builder

一个面向**动漫文生图测试集制作**的轻量工具，用来统一整理 case，避免大家各写各的、各存各的。

在线使用：

**https://qing-claw.github.io/case-dataset-builder/**

---

## 这个工具能做什么

这个工具用于制作符合以下结构的测试 case：

```text
dataset/
  cases/
    <case_folder>/
      case.json
      ref/
        ref_01.png
        ref_02.jpg
```

每条 case 都是一个独立子文件夹，里面包含：
- `case.json`：case 的结构化定义
- `ref/`：参考图文件夹（如果有）

`case.json` 中的 `ref` 使用**相对路径**，例如：

```json
{
  "dimension": ["风格表现"],
  "sub_dimension": ["指定画风还原"],
  "prompt": [
    "1girl, white hair, blue eyes, school uniform, anime style"
  ],
  "ref": ["ref/ref_01.png"],
  "check_points": ["画风接近", "线条干净", "上色方式一致"],
  "pass_rule": "3 个检查点满足 2 个及以上算通过"
}
```

这样做的好处是：
- 一个 case 自包含，方便分发和复用
- 目录结构统一，适合多人协作搜集
- 不依赖本地绝对路径，后续脚本处理更稳

---

## 怎么使用

### 1. 新建 case
点击 **“新建 case”**，创建一条新的测试 case。

### 2. 填写基础字段
按需要填写：
- `dimension`
- `sub_dimension`
- `prompt`
- `check_points`（可选）
- `pass_rule`（可选）

其中：
- `dimension`、`sub_dimension`、`prompt` 都支持多项
- 一条 case 可以同时覆盖多个能力点和多种 prompt 表达

### 3. 上传参考图
如果该 case 需要参考图，可以直接上传。

工具会自动：
- 把参考图放到 `ref/` 目录
- 生成类似 `ref/ref_01.png` 的相对路径
- 写入 `case.json` 的 `ref` 字段

### 4. 查看结构预览
页面右侧会实时展示：
- `case.json` 预览
- 导出后的目录结构预览
- 当前 case 是否缺少必填字段

### 5. 导出
支持两种导出方式：

- **导出当前 case**：导出单条 case 的 ZIP
- **导出数据集 ZIP**：导出整个数据集

导出后的结构就是标准目录结构，可以直接解压后使用。

### 6. 导入已有数据集
如果你已经有符合规范的数据集 ZIP，也可以直接导入继续编辑。

---

## 当前支持的能力

- 新建 / 复制 / 删除 case
- 编辑多值字段
- 上传参考图并自动生成相对路径
- 实时预览 `case.json`
- 导出单个 case ZIP
- 导出整个数据集 ZIP
- 导入已有数据集 ZIP
- 浏览器本地自动保存
- 搜索与按维度过滤

---

## 适合什么场景

适合这类工作：
- 动漫文生图测试集制作
- 多人协作搜集参考图和 prompt
- 统一 case 结构，减少脏数据
- 前期快速搭测试题库

如果你现在最需要的是：
**先把 case 写清楚，再逐步补图、补规则、补评测流程**，这工具就是干这个的。
