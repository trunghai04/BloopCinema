import { useEffect, useState } from "react";
import { deleteAdminTheater, getAdminTheaters, upsertAdminTheater } from "../../api/client";

const EMPTY = { id: "", name: "", city: "", code: "", active: true };

export default function AdminTheatersPage({ onCreated }) {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setError("");
      const data = await getAdminTheaters();
      setItems(data || []);
    } catch (e) {
      setError(e?.message || "Không tải được rạp.");
    }
  };

  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await upsertAdminTheater({
        ...draft,
        id: String(draft.id || "").trim(),
        name: String(draft.name || "").trim(),
        city: String(draft.city || "").trim(),
        code: String(draft.code || "").trim(),
        active: Boolean(draft.active)
      });
      setDraft(EMPTY);
      await load();
      if (typeof onCreated === "function") onCreated();
    } catch (e) {
      setError(e?.message || "Lưu rạp thất bại.");
    }
  }

  async function remove(id) {
    try {
      await deleteAdminTheater(id);
      await load();
    } catch (e) {
      setError(e?.message || "Xóa rạp thất bại.");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, alignItems: "start" }}>
      {/* Form block */}
      <div className="admin-glass-panel">
        <h2>Quản lý rạp</h2>
        <form className="admin-glass-form" onSubmit={submit}>
          <label>
            <span>Mã Rạp (id)</span>
            <input placeholder="ví dụ: hanoi" value={draft.id} onChange={(e) => setDraft((p) => ({ ...p, id: e.target.value }))} />
          </label>
          <label>
            <span>Tên rạp</span>
            <input placeholder="Tên rạp" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label>
            <span>Thành phố</span>
            <input placeholder="Thành phố" value={draft.city} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} />
          </label>
          <label>
            <span>Mã code rạp</span>
            <input placeholder="Mã code" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} />
          </label>
          <button type="submit" className="admin-login-submit">Lưu rạp</button>
        </form>
      </div>

      {/* List block */}
      <div className="admin-glass-panel">
        <h2>Danh sách rạp</h2>
        {error ? <p className="book-error" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5", padding: "12px 14px", borderRadius: "12px", fontSize: "13px" }}>{error}</p> : null}
        <div className="admin-table-container">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Tên rạp</th>
                <th>Thông tin</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td><code>{item.id}</code> · {item.city || ""} · {item.code || ""}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" className="btn-secondary" onClick={() => setDraft(item)}>Sửa</button>
                      <button type="button" className="btn-secondary" onClick={() => remove(item.id)}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
