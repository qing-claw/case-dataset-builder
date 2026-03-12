# Case Dataset Builder

一个可直接部署到 **GitHub Pages** 的静态前端工具，用来制作符合以下结构的动漫文生图 case 数据集。

## 导出结构

```text
dataset/
  dataset_summary.json
  cases/
    <case_folder>/
      case.json
      ref/
        ref_01.png
        ref_02.jpg
```

单个 case 的最小结构：

```text
<case_folder>/
  case.json
  ref/
```

如果没有参考图，则不生成 `ref/`。

## case.json 格式

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

## 当前功能

- 新建 / 复制 / 删除 case
- 编辑 `dimension` / `sub_dimension` / `prompt` / `check_points` / `pass_rule`
- 上传参考图，自动生成 `ref/ref_XX.ext` 相对路径
- 实时预览 `case.json`
- 导出单个 case ZIP
- 导出整个数据集 ZIP
- 导入已有数据集 ZIP
- 浏览器本地自动保存
- 搜索与按维度过滤

## GitHub Pages 部署

这个项目是纯静态页面，不需要构建。

### 方式一：单独建一个 GitHub 仓库（推荐）

把当前目录里的文件放到仓库根目录：

```text
.github/workflows/deploy-pages.yml
index.html
styles.css
app.js
README.md
```

然后：

1. 推到 GitHub 仓库的 `main` 分支
2. 打开仓库设置 `Settings -> Pages`
3. 在 `Build and deployment` 中选择 `GitHub Actions`
4. 推送一次后，Actions 会自动部署

### 方式二：作为子目录继续维护

如果你想保留在大仓库里，也可以，但 GitHub Pages 默认不会直接部署子目录。那就需要：
- 单独拆仓库
- 或额外加一层构建 / 同步脚本

所以如果只是为了快速测试，**单独建仓库最省事**。

## 本地预览

```bash
python3 -m http.server 4173
```

然后打开：

```text
http://127.0.0.1:4173
```

## 注意

- 图片文件目前保存在浏览器本地存储中，适合测试和轻量使用。
- 大量高分辨率图片可能导致浏览器存储压力变大。
- 当前还没有做多人协作云同步；这是后续能力，不是这版 MVP 的职责。
