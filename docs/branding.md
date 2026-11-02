# 项目标识

项目采用 B 方案「Radar R」：实心 R 表示 Radar，右上角的圆点表示持续追踪的新信号。导航栏使用符号和现有项目名称，README 使用横向字标。

主色沿用网站：浅色外观为 `#625a8c`，深色外观为 `#b6acf5`。页面中的 SVG 跟随外观切换；独立 SVG 资源和 favicon 根据系统外观适配颜色。

favicon 去掉信号点，保留实心 R，以适应 16px 的浏览器标签页。SVG 为优先格式，ICO 提供 16px、32px 和 48px 兼容版本，并使用浅底确保辨识度。Apple Touch Icon 为 180px。

- [独立符号](../apps/web/public/brand/mark.svg)
- [横向字标](../apps/web/public/brand/logo.svg)
- [favicon SVG](../apps/web/public/favicon.svg)
- [favicon ICO](../apps/web/public/favicon.ico)
- [Apple Touch Icon](../apps/web/public/apple-touch-icon.png)

新增入口时应继续使用共享的 `BrandMark` 组件，保持符号形状和深浅色一致。资源随项目按 MIT 许可提供。
