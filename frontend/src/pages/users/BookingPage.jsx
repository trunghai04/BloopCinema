import { useState } from "react";
import { createBooking } from "../../api/client";

const initialState = {
  userEmail: "",
  movieId: "",
  showtimeId: "",
  seatCode: ""
};

export default function BookingPage() {
  const [form, setForm] = useState(initialState);
  const [result, setResult] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function submitBooking(event) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await createBooking(form);
      setResult(`Đặt chỗ thành công: ${data.id}`);
      setForm(initialState);
    } catch (_error) {
      setResult("Đặt chỗ lỗi, kiểm tra backend hoặc dữ liệu nhập.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <h2 className="section-title">Đặt chỗ</h2>
      <p className="section-muted">Điền đúng mã phim và mã suất chiếu.</p>
      <form onSubmit={submitBooking}>
        <input
          name="userEmail"
          value={form.userEmail}
          onChange={updateField}
          placeholder="Email"
        />
        <input
          name="movieId"
          value={form.movieId}
          onChange={updateField}
          placeholder="Mã phim"
        />
        <input
          name="showtimeId"
          value={form.showtimeId}
          onChange={updateField}
          placeholder="Mã lịch chiếu"
        />
        <input
          name="seatCode"
          value={form.seatCode}
          onChange={updateField}
          placeholder="Ghế (VD A01)"
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Đang gửi..." : "Đặt ngay"}
        </button>
      </form>
      <p className="section-muted">{result}</p>
    </section>
  );
}

