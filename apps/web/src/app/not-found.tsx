import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>没有找到这个页面</h1>
      <p>文章可能尚未收录，或已经停止公开展示。</p>
      <Link href="/">返回文章索引</Link>
    </div>
  );
}
