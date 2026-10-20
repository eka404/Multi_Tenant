import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-400">That page doesn't exist or was moved.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">Back to your organizations</Link>
    </div>
  );
}