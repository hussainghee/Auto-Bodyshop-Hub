Apply these changes to frontend/src/pages/JobDetail.jsx

1) Replace import:
import { api, fileUrl, fmtKWD, fmtDateTime, waLink } from "../lib/api";
with:
import { api, fileUrl, fmtKWD, fmtDateTime } from "../lib/api";

2) After:
const [internalSaving, setInternalSaving] = useState(false);
add:
const [waSending, setWaSending] = useState(false);

3) After saveInternalNotes function, add:
const sendWhatsAppInvoice = async () => {
  if (!job?.customer?.mobile) {
    toast.error("Customer mobile number is missing");
    return;
  }
  setWaSending(true);
  try {
    const { data } = await api.post(`/jobs/${id}/whatsapp/invoice`);
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
{job.customer?.mobile && waEnabled && (
  <Button
    type="button"
    onClick={sendWhatsAppInvoice}
    disabled={waSending}
    variant="outline"
    className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 rounded-sm no-print"
    data-testid="wa-share-invoice"
  >
    <MessageCircle size={14} className="mr-1.5" />
    {waSending ? "Sending…" : "WhatsApp"}
  </Button>
)}
