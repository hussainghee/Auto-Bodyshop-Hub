Apply these changes to frontend/src/pages/QuotationDetail.jsx

1) Replace import:
import { api, fmtKWD, fmtDate, waLink } from "../lib/api";
with:
import { api, fmtKWD, fmtDate } from "../lib/api";

2) After:
const [q, setQ] = useState(null);
add:
const [waSending, setWaSending] = useState(false);

3) After markRejected function, add:
const sendWhatsAppQuotation = async () => {
  if (!q?.customer?.mobile) {
    toast.error("Customer mobile number is missing");
    return;
  }
  setWaSending(true);
  try {
    const { data } = await api.post(`/quotations/${id}/whatsapp`);
    toast.success(data?.message || "WhatsApp message sent successfully");
  } catch (err) {
    console.error("WhatsApp send failed:", err);
    toast.error(err?.response?.data?.detail || "Failed to send WhatsApp message");
  } finally {
    setWaSending(false);
  }
};

4) Delete the const waMsg line.

5) Replace the WhatsApp <a href={waLink(...)}> block with:
{q.customer?.mobile && waEnabled && (
  <Button
    type="button"
    onClick={sendWhatsAppQuotation}
    disabled={waSending}
    variant="outline"
    className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-sm no-print"
    data-testid="wa-share-quotation"
  >
    <MessageCircle size={14} className="mr-1.5" />
    {waSending ? "Sending…" : "WhatsApp"}
  </Button>
)}
