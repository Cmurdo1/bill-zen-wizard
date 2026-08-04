import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeEstimatePhotos } from "@/lib/estimates.functions";
import type { LineItem } from "@/lib/documents";
import { Loader2, ImagePlus, Sparkles, Trash2 } from "lucide-react";

type PhotoRow = { id: string; storage_path: string; caption: string | null; url?: string };

export function EstimateAiPanel({
  estimateId,
  currency,
  description,
  onDescriptionChange,
  onItems,
  canUseAI,
}: {
  estimateId: string;
  currency: string;
  description: string;
  onDescriptionChange: (v: string) => void;
  onItems: (items: LineItem[]) => void;
  canUseAI: boolean;
}) {
  const analyze = useServerFn(analyzeEstimatePhotos);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    measurements: Array<{ label: string; value: string; confidence: string }>;
    assumptions: string[];
  } | null>(null);

  async function loadPhotos() {
    const { data } = await supabase
      .from("estimate_photos")
      .select("id,storage_path,caption")
      .eq("estimate_id", estimateId)
      .order("created_at");
    const rows = (data as PhotoRow[]) ?? [];
    const withUrls = await Promise.all(
      rows.map(async (r) => {
        const { data: signed } = await supabase.storage.from("estimate-photos").createSignedUrl(r.storage_path, 3600);
        return { ...r, url: signed?.signedUrl };
      }),
    );
    setPhotos(withUrls);
  }
  useEffect(() => { void loadPhotos(); }, [estimateId]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      for (const file of Array.from(files).slice(0, 10)) {
        if (!file.type.startsWith("image/")) throw new Error("Only image files can be uploaded.");
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10MB.`);
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${user.id}/${estimateId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("estimate-photos").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("estimate_photos").insert({
          estimate_id: estimateId,
          user_id: user.id,
          storage_path: path,
          caption: file.name.slice(0, 80),
        });
        if (insErr) throw insErr;
      }
      await loadPhotos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto(p: PhotoRow) {
    await supabase.storage.from("estimate-photos").remove([p.storage_path]);
    await supabase.from("estimate_photos").delete().eq("id", p.id);
    await loadPhotos();
  }

  async function run() {
    setError(null);
    if (description.trim().length < 10) {
      setError("Write a brief description of the job first (at least a sentence).");
      return;
    }
    setRunning(true);
    try {
      const res = await analyze({ data: { estimateId, description: description.trim(), currency } });
      onItems(
        res.items.map((i: { description: string; quantity: number; rate_cents: number }) => ({
          description: i.description,
          quantity: i.quantity,
          rate_cents: i.rate_cents,
        })),
      );
      setResult({ measurements: res.measurements, assumptions: res.assumptions });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI estimate failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">AI photo estimate</h2>
        <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Brief job description (required)</span>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          placeholder="Repaint exterior siding and trim on a two-story house, includes pressure wash, minor caulking, and two coats."
          className="block w-full rounded-lg border border-border bg-background p-3 text-sm"
        />
      </label>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-lg border border-border">
            {p.url ? (
              <img src={p.url} alt={p.caption ?? "Job photo"} className="h-24 w-full object-cover" />
            ) : (
              <div className="h-24 w-full bg-surface-muted" />
            )}
            <button
              onClick={() => removePhoto(p)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs font-semibold text-muted-foreground hover:bg-surface-muted disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="inline-flex flex-col items-center gap-1"><ImagePlus className="h-4 w-4" /> Add photos</span>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => upload(e.target.files)} />
      </div>

      <button
        onClick={run}
        disabled={running || !canUseAI}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-soft disabled:opacity-60"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {running ? "Measuring & pricing…" : "Generate line items from photos"}
      </button>
      {!canUseAI && (
        <p className="mt-2 text-xs text-muted-foreground">AI photo estimating is included with Pro and Business plans.</p>
      )}
      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}

      {result && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Measurements</h3>
            <ul className="mt-2 space-y-1 text-xs">
              {result.measurements.map((m, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="tabular-nums">{m.value} <span className="text-muted-foreground">({m.confidence})</span></span>
                </li>
              ))}
              {result.measurements.length === 0 && <li className="text-muted-foreground">None derived.</li>}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Assumptions</h3>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              {result.assumptions.length === 0 && <li>None.</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
