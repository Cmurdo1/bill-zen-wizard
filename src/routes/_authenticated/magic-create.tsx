import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { AppShell } from "@/components/app/shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";
import {
  useCreateInvoice,
  useAddInvoiceItems,
  useAddEstimateItems,
  useRecalculateInvoiceTotals,
  useRecalculateEstimateTotals,
} from "@/hooks/useInvoices";
import { useProfile } from "@/hooks/useProfile";
import { extractLineItems } from "@/lib/invoices.functions";
import { SendDocumentModal } from "@/components/app/send-document-modal";
import { useSendDocument, useMyEmail } from "@/hooks/useInvoices";
import {
  Loader2,
  Wand2,
  Sparkles,
  ArrowRight,
  Mic,
  MicOff,
  MapPin,
  RefreshCw,
  ImagePlus,
  X,
  Camera,
  FileText,
  Download,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadedImage {
  file: File;
  preview: string;
  base64: string;
  mimeType: string;
}

interface ExtractedLineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export const Route = createFileRoute("/_authenticated/magic-create")({
  validateSearch: (search) => ({
    type: search.type ?? "invoice",
  }),
  head: () => ({
    meta: [{ title: "Magic Create — Honest Invoice" }, { name: "robots", content: "noindex" }],
  }),
  component: MagicCreatePage,
});

function MagicCreatePage() {
  const navigate = useNavigate();
  const { type } = useSearch({ from: "/_authenticated/magic-create" });
  const isEstimate = type === "estimate";
  const label = isEstimate ? "Estimate" : "Invoice";

  const { data: clients } = useClients();
  const { data: profile } = useProfile();
  const createInvoice = useCreateInvoice();
  const addInvoiceItems = useAddInvoiceItems();
  const addEstimateItems = useAddEstimateItems();
  const recalculateTotals = useRecalculateInvoiceTotals();
  const recalculateEstimateTotals = useRecalculateEstimateTotals();

  const [jobDescription, setJobDescription] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedLineItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [pendingSend, setPendingSend] = useState<{
    type: "invoice" | "estimate";
    id: string;
    invoice_number: string;
    total_cents: number;
    due_date: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendDoc = useSendDocument();
  const { data: myEmail } = useMyEmail();

  const currentLocation =
    profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : null;

  const currentColMultiplier = profile?.col_multiplier || 1.0;

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;

    const maxImages = 5;
    const remaining = maxImages - uploadedImages.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remaining);
    const newImages: UploadedImage[] = [];

    for (const file of filesToProcess) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        base64,
        mimeType: file.type,
      });
    }

    setUploadedImages((prev) => [...prev, ...newImages]);
    if (newImages.length > 0) {
      toast.success(`${newImages.length} photo${newImages.length > 1 ? "s" : ""} added`);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleExtract = async () => {
    if (!jobDescription.trim() && uploadedImages.length === 0) {
      toast.error("Please enter a job description or upload photos");
      return;
    }

    setExtracting(true);
    setExtractedItems(null);

    try {
      // Upload images to Supabase storage first if any
      let estimateId: string | undefined;
      if (uploadedImages.length > 0) {
        // Create a temporary estimate to attach photos to
        const tempInvoice = await createInvoice.mutateAsync({
          client_id: selectedClientId || null,
          job_description: jobDescription,
          type: type,
        });
        estimateId = tempInvoice.id;

        // Upload photos to the estimate
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          for (const img of uploadedImages) {
            try {
              const ext =
                img.file.name
                  .split(".")
                  .pop()
                  ?.toLowerCase()
                  .replace(/[^a-z0-9]/g, "") || "jpg";
              const path = `${user.id}/${estimateId}/${crypto.randomUUID()}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from("estimate-photos")
                .upload(path, img.file, { contentType: img.mimeType, upsert: false });
              if (upErr) continue;
              const { error: insErr } = await supabase.from("estimate_photos").insert({
                estimate_id: estimateId,
                user_id: user.id,
                storage_path: path,
                caption: img.file.name.slice(0, 80),
              });
              if (insErr) continue;
            } catch {
              // Legacy deployments may lack the estimate_photos table or the
              // storage bucket — extraction still works from the description.
            }
          }
        }
      }

      const response = await extractLineItems({
        data: {
          description:
            jobDescription || "Analyze the uploaded photos and provide a detailed estimate.",
          currency: "USD",
          estimateId,
        },
      });

      // Transform the response to match ExtractedLineItem interface
      const items = response.items.map(
        (item: { description: string; quantity: number; rate_cents: number }) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.rate_cents / 100, // Convert cents to dollars for UI
        }),
      );

      setExtractedItems(items);

      const photoNote =
        uploadedImages.length > 0
          ? ` (analyzed ${uploadedImages.length} photo${uploadedImages.length > 1 ? "s" : ""})`
          : "";
      const colNote = ""; // Pricing rules now handled by AI with user's rate book
      toast.success(`Extracted ${items.length} line items${photoNote}${colNote}`);
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error("Failed to extract items. Please try again.");
    } finally {
      setExtracting(false);
    }
  };

  const handleCreateInvoice = async (emailAfter = false) => {
    if (!extractedItems || extractedItems.length === 0) {
      toast.error(`Please extract line items first`);
      return;
    }

    setCreating(true);

    try {
      const created = await createInvoice.mutateAsync({
        client_id: selectedClientId || null,
        job_description: jobDescription,
        type: type,
      });
      // createInvoiceRecord returns {id,invoice_number}, createEstimateRecord
      // returns {id,estimate_number} — normalize to a single shape.
      const invoice = {
        id: created.id,
        invoice_number: isEstimate
          ? (created as { estimate_number: string }).estimate_number
          : (created as { invoice_number: string }).invoice_number,
      };

      if (isEstimate) {
        await addEstimateItems.mutateAsync({
          estimate_id: invoice.id,
          items: extractedItems.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            rate_cents: Math.round(item.unit_price * 100), // Convert dollars back to cents
            sort_order: index,
          })),
        });

        await recalculateEstimateTotals.mutateAsync({
          estimate_id: invoice.id,
          tax_rate: profile?.tax_rate || 0,
        });
      } else {
        await addInvoiceItems.mutateAsync({
          invoice_id: invoice.id,
          items: extractedItems.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            rate_cents: Math.round(item.unit_price * 100), // Convert dollars back to cents
            sort_order: index,
          })),
        });

        await recalculateTotals.mutateAsync({
          invoice_id: invoice.id,
          tax_rate: profile?.tax_rate || 0,
        });
      }

      toast.success(`${label} created!`);
      if (emailAfter) {
        // Open the send modal; navigate after it closes or sends.
        setPendingSend({
          type: isEstimate ? "estimate" : "invoice",
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          total_cents: Math.round(estimatedTotal * 100),
          due_date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
        });
      } else {
        navigate({
          to: isEstimate ? "/estimates/$id" : "/invoices/$id",
          params: { id: invoice.id },
        });
      }
    } catch (error) {
      console.error(`Create ${type} error:`, error);
      toast.error(`Failed to create ${type}`);
    } finally {
      setCreating(false);
    }
  };

  const estimatedTotal =
    extractedItems?.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) || 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-foreground">
            {label} Generator
          </h1>
          <p className="text-muted-foreground">
            Describe the job, upload job-site photos, or both — the AI will estimate line items for
            you
          </p>
        </div>

        {/* Location Card */}
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {currentLocation ? (
                    <>
                      {currentLocation}
                      <Badge variant="secondary" className="ml-2">
                        {currentColMultiplier === 1.0
                          ? "National Avg"
                          : `${currentColMultiplier}x Regional`}{" "}
                        ({currentColMultiplier}x)
                      </Badge>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Location not set</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentLocation
                    ? "Prices adjusted for your region based on Settings"
                    : "Set your Zip Code in Settings for accurate regional pricing"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {currentLocation ? "Change" : "Configure"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Job Description
            </CardTitle>
            <CardDescription>
              Describe the work and/or upload photos of the job site. The AI analyzes both to build
              an honest, detailed estimate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Client select */}
            <div className="space-y-2">
              <Label htmlFor="client">Client (optional)</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Job Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Job Description</Label>
              </div>
              <div className="relative">
                <Textarea
                  id="description"
                  placeholder="Example: Clean the roof shown in photos — remove moss, debris, and treat with fungicide. Or describe the job in plain language."
                  className={cn("min-h-[120px] resize-none transition-all")}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Photo Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Job Site Photos
                  <Badge variant="secondary" className="text-xs font-normal">
                    AI Vision
                  </Badge>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {uploadedImages.length}/5 photos
                </span>
              </div>

              {/* Image previews */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {uploadedImages.map((img, index) => (
                    <div
                      key={index}
                      className="group relative aspect-video overflow-hidden rounded-lg border bg-muted"
                    >
                      <img
                        src={img.preview}
                        alt={`Job site photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 shadow transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {uploadedImages.length < 5 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                    >
                      <ImagePlus className="h-6 w-6" />
                    </button>
                  )}
                </div>
              )}

              {/* Upload area (shown when no images yet) */}
              {uploadedImages.length === 0 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Upload job site photos</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      The AI will analyze the images to estimate scope and materials
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      JPG
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      PNG
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      HEIC
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      up to 10MB
                    </Badge>
                  </div>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files)}
                onClick={(e) => {
                  (e.target as HTMLInputElement).value = "";
                }}
              />
            </div>

            <Button
              onClick={handleExtract}
              disabled={extracting || (!jobDescription.trim() && uploadedImages.length === 0)}
              className="w-full gap-2"
              size="lg"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {uploadedImages.length > 0 ? "Analyzing photos & extracting..." : "Extracting..."}
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  {uploadedImages.length > 0
                    ? `Analyze ${uploadedImages.length} Photo${uploadedImages.length > 1 ? "s" : ""} & Extract`
                    : "Auto-Extract Details"}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {extractedItems && extractedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Extracted Line Items</CardTitle>
              <CardDescription>
                Review and adjust the extracted items before creating the {label.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentColMultiplier !== 1.0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Regional Pricing Applied
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {currentLocation} ({currentColMultiplier}x multiplier)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">National Average</p>
                      <p className="text-sm line-through text-muted-foreground">
                        ${(estimatedTotal / currentColMultiplier).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium">Description</th>
                      <th className="p-3 text-right text-sm font-medium">Qty</th>
                      <th className="p-3 text-right text-sm font-medium">
                        {currentColMultiplier !== 1.0 ? (
                          <span className="flex flex-col items-end">
                            <span>Regional</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              (Nat'l Avg)
                            </span>
                          </span>
                        ) : (
                          "Price"
                        )}
                      </th>
                      <th className="p-3 text-right text-sm font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedItems.map((item, index) => {
                      const nationalPrice =
                        currentColMultiplier !== 1.0
                          ? item.unit_price / currentColMultiplier
                          : null;
                      return (
                        <tr key={index} className="border-b last:border-0">
                          <td className="p-3 text-sm">{item.description}</td>
                          <td className="p-3 text-right text-sm">{item.quantity}</td>
                          <td className="p-3 text-right text-sm">
                            {currentColMultiplier !== 1.0 && nationalPrice ? (
                              <>
                                <div className="font-medium">${item.unit_price.toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground">
                                  ${nationalPrice.toFixed(2)}
                                </div>
                              </>
                            ) : (
                              <div className="font-medium">${item.unit_price.toFixed(2)}</div>
                            )}
                          </td>
                          <td className="p-3 text-right text-sm font-medium">
                            ${(item.quantity * item.unit_price).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between text-lg font-bold border-t pt-4">
                <span>Estimated Total</span>
                <span>${estimatedTotal.toFixed(2)}</span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={() => handleCreateInvoice(false)}
                  disabled={creating}
                  variant="outline"
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <FileText className="h-5 w-5" />
                  Create {label}
                </Button>
                <Button
                  onClick={() => handleCreateInvoice(true)}
                  disabled={creating}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  {creating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                  {creating ? "Creating..." : `Create & email`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {pendingSend && (
        <SendDocumentModal
          open={!!pendingSend}
          onClose={() => {
            const doc = pendingSend;
            setPendingSend(null);
            navigate({
              to: doc.type === "estimate" ? "/estimates/$id" : "/invoices/$id",
              params: { id: doc.id },
            });
          }}
          title={`Send ${pendingSend.invoice_number}`}
          defaultTo={clients?.find((c) => c.id === selectedClientId)?.email ?? ""}
          clients={clients ?? []}
          myEmail={myEmail ?? ""}
          onSend={async (to, message) => {
            const doc = pendingSend;
            const client = clients?.find((c) => c.id === selectedClientId);
            await sendDoc.mutateAsync({
              type: doc.type,
              id: doc.id,
              invoice_number: doc.invoice_number,
              client_name: client?.name ?? "Client",
              client_email: to,
              total_amount: doc.total_cents / 100,
              due_date: doc.due_date,
              job_description: jobDescription.trim() || null,
              message,
            });
            toast.success(
              `${doc.type === "estimate" ? "Estimate" : "Invoice"} ${doc.invoice_number} emailed to ${to}`,
            );
            setPendingSend(null);
            navigate({
              to: doc.type === "estimate" ? "/estimates/$id" : "/invoices/$id",
              params: { id: doc.id },
            });
          }}
        />
      )}
    </AppShell>
  );
}
