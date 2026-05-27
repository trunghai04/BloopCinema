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
    <div className="admin-horizontal-section">
      <form className="item-card admin-form admin-panel admin-horizontal-card" onSubmit={submit}>
        <h2>Quản lý rạp</h2>
        <input placeholder="id" value={draft.id} onChange={(e) => setDraft((p) => ({ ...p, id: e.target.value }))} />
        <input placeholder="Tên rạp" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
        <input placeholder="Thành phố" value={draft.city} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} />
        <input placeholder="Mã code" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value }))} />
        <button type="submit">Lưu rạp</button>
      </form>

      <div className="item-card admin-list admin-panel admin-horizontal-card">
        <h2>Danh sách rạp</h2>
        {error ? <p className="book-error">{error}</p> : null}
        <div className="admin-horizontal-items">
          {items.map((item) => (
            <div key={item.id} className="admin-row admin-row--horizontal">
              <div className="admin-row__main">
                <strong>{item.name}</strong>
                <span>{item.id} · {item.city || ""} · {item.code || ""}</span>
              </div>
              <div className="admin-row__actions">
                <button type="button" className="btn-secondary" onClick={() => setDraft(item)}>Sửa</button>
                <button type="button" className="btn-secondary" onClick={() => remove(item.id)}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
