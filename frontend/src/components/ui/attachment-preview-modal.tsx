import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./modal";

type AttachmentPreviewModalProps = {
  open: boolean;
  title?: string;
  fileName: string;
  url?: string;
  mimeType?: string;
  onClose: () => void;
  onDownload?: () => void;
};

function fileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function previewKind(fileName: string, mimeType?: string) {
  const extension = fileExtension(fileName);
  const type = mimeType?.toLowerCase() ?? "";
  if (
    type.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(extension)
  ) {
    return "image";
  }
  if (type === "application/pdf" || extension === "pdf") {
    return "pdf";
  }
  if (type.startsWith("video/") || ["mp4", "webm", "ogg"].includes(extension)) {
    return "video";
  }
  if (type.startsWith("audio/") || ["mp3", "wav", "ogg"].includes(extension)) {
    return "audio";
  }
  if (
    type.startsWith("text/") ||
    ["txt", "csv", "xml", "json"].includes(extension)
  ) {
    return "document";
  }
  return "unsupported";
}

export function AttachmentPreviewModal({
  open,
  title = "Previsualizar arquivo",
  fileName,
  url,
  mimeType,
  onClose,
  onDownload,
}: AttachmentPreviewModalProps) {
  const kind = previewKind(fileName, mimeType);

  return (
    <Modal
      open={open}
      title={title}
      description={fileName}
      size="xl"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="min-h-[420px] overflow-hidden rounded-lg border border-fleet-line bg-zinc-50">
          {!url && (
            <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center text-sm text-zinc-500">
              <FileText className="mb-3 text-zinc-400" />
              Arquivo indisponivel para previsualizacao.
            </div>
          )}
          {url && kind === "image" && (
            <img
              src={url}
              alt={fileName}
              className="max-h-[70vh] w-full object-contain"
            />
          )}
          {url && kind === "pdf" && (
            <iframe
              title={fileName}
              src={url}
              className="h-[70vh] w-full bg-white"
            />
          )}
          {url && kind === "document" && (
            <iframe
              title={fileName}
              src={url}
              className="h-[70vh] w-full bg-white"
            />
          )}
          {url && kind === "video" && (
            <video
              src={url}
              className="max-h-[70vh] w-full bg-black"
              controls
            />
          )}
          {url && kind === "audio" && (
            <div className="flex min-h-[420px] items-center justify-center p-6">
              <audio src={url} controls className="w-full" />
            </div>
          )}
          {url && kind === "unsupported" && (
            <div className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
              <FileText className="mb-3 text-zinc-400" size={36} />
              <strong className="text-fleet-ink">
                Previa não disponivel para este formato.
              </strong>
              <p className="mt-2 max-w-md text-sm text-zinc-500">
                Voce ainda pode abrir em uma nova guia ou baixar o arquivo.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {url && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink size={16} />
              Abrir em nova guia
            </Button>
          )}
          <Button type="button" onClick={onDownload}>
            <Download size={16} />
            Baixar arquivo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
