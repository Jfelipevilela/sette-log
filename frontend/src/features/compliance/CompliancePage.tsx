import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Edit2,
  Eye,
  Filter,
  FilePlus2,
  FileWarning,
  Paperclip,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { ActionMenu } from "../../components/ui/action-menu";
import { AttachmentPreviewModal } from "../../components/ui/attachment-preview-modal";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { DetailModal } from "../../components/ui/detail-modal";
import { Input } from "../../components/ui/input";
import { Modal } from "../../components/ui/modal";
import { SearchableSelect } from "../../components/ui/searchable-select";
import { StatCard } from "../../components/ui/stat-card";
import { Table, Td, Th } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import {
  apiErrorMessage,
  createComplianceCheck,
  createDocument,
  deleteComplianceCheck,
  deleteDocument,
  downloadResourceExport,
  downloadComplianceCheckAttachment,
  downloadExternalFile,
  fetchComplianceCheckAttachmentBlob,
  getDrivers,
  getVehicles,
  listAllResourcePages,
  listResource,
  listResourcePage,
  updateComplianceCheck,
  updateDocument,
  uploadComplianceCheckAttachments,
} from "../../lib/api";
import {
  documentTypeLabels,
  entityTypeLabels,
  labelFor,
} from "../../lib/labels";
import type { DocumentRecord } from "../../lib/types";
import { formatDate } from "../../lib/utils";

const safetyChecklistItems = [
  { key: "safety_buzina", label: "Buzina" },
  { key: "safety_chave_roda", label: "Chave de roda" },
  { key: "safety_cintos", label: "Cintos" },
  { key: "safety_extintor", label: "Extintor" },
  { key: "safety_limpadores", label: "Limpadores" },
  { key: "safety_macaco", label: "Macaco" },
  { key: "safety_painel", label: "Painel" },
  { key: "safety_retrovisor_interno", label: "Retrovisor interno" },
  { key: "safety_retrovisor_direito", label: "Retrovisor direito" },
  { key: "safety_retrovisor_esquerdo", label: "Retrovisor esquerdo" },
  { key: "safety_triangulo", label: "Triangulo" },
];

const motorChecklistItems = [
  { key: "motor_acelerador", label: "Acelerador" },
  { key: "motor_agua_limpador", label: "Água do limpador" },
  { key: "motor_agua_radiador", label: "Água do radiador" },
  { key: "motor_embreagem", label: "Embreagem" },
  { key: "motor_freio", label: "Freio" },
  { key: "motor_freio_mao", label: "Freio de mao" },
  { key: "motor_oleo_freio", label: "Oleo de freio" },
  { key: "motor_oleo_motor", label: "Oleo de motor" },
  { key: "motor_partida", label: "Motor de partida" },
];

const conservationItems = [
  { key: "conservation_external_cleaning", label: "Limpeza externa" },
  { key: "conservation_internal_cleaning", label: "Limpeza interna" },
  { key: "conservation_tires", label: "Pneus" },
  { key: "conservation_spare_tire", label: "Estepe" },
];

const rearLightingItems = [
  { key: "rear_right_reverse", label: "Traseira direita - Re" },
  { key: "rear_right_brake", label: "Traseira direita - Freio" },
  { key: "rear_right_turn", label: "Traseira direita - Seta" },
  { key: "rear_left_reverse", label: "Traseira esquerda - Re" },
  { key: "rear_left_brake", label: "Traseira esquerda - Freio" },
  { key: "rear_left_turn", label: "Traseira esquerda - Seta" },
  { key: "rear_plate_light", label: "Luz da placa traseira" },
];

const frontLightingItems = [
  { key: "front_right_high_beam", label: "Lado direito - Farol alto" },
  { key: "front_right_low_beam", label: "Lado direito - Farol baixo" },
  { key: "front_right_turn", label: "Lado direito - Seta" },
  { key: "front_right_fog", label: "Lado direito - Neblina" },
  { key: "front_left_high_beam", label: "Lado esquerdo - Farol alto" },
  { key: "front_left_low_beam", label: "Lado esquerdo - Farol baixo" },
  { key: "front_left_turn", label: "Lado esquerdo - Seta" },
  { key: "front_left_fog", label: "Lado esquerdo - Neblina" },
  { key: "front_plate_light", label: "Luz da placa dianteira" },
];

const conservationOptions = [
  { value: "bom", label: "Bom" },
  { value: "médio", label: "Medio" },
  { value: "ruim", label: "Ruim" },
];

const lightingOptions = [
  { value: "ok", label: "Funcionamento OK" },
  { value: "failed", label: "Não funcionando" },
];

const checklistSteps = [
  "Identificação",
  "Condições de conservação",
  "Iluminação traseira",
  "Iluminação dianteira",
  "Itens de segurança",
  "Motor e sistemas associados",
  "Danos e observações",
  "Anexos e finalização",
];

const requiredChecklistFieldsByStep: Record<
  number,
  Array<{ name: string; label: string }>
> = {
  0: [
    { name: "vehicleId", label: "Veículo" },
    { name: "deliveryOdometerKm", label: "Km de entrega" },
    { name: "deliveredAt", label: "Data da entrega" },
  ],
  6: [{ name: "responsibleName", label: "Responsavel pela entrega" }],
};

type ComplianceCheckRecord = {
  _id: string;
  vehicleId?: string;
  driverId?: string;
  checklistVersion: string;
  templateId?: string;
  items: Array<{
    key: string;
    label: string;
    section?: string;
    result?: string;
    notes?: string;
  }>;
  attachments?: Array<{
    originalName: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  }>;
  status: "passed" | "failed" | "pending";
  performedAt: string;
  createdAt?: string;
};

function checklistItemFromForm(
  form: FormData,
  item: { key: string; label: string },
  section: string,
) {
  const isWorking = form.get(item.key) === "on";
  return {
    key: item.key,
    label: item.label,
    section,
    result: isWorking ? "ok" : "failed",
  };
}

function selectedChecklistItemFromForm(
  form: FormData,
  item: { key: string; label: string },
  section: string,
  fallback: string,
) {
  return {
    key: item.key,
    label: item.label,
    section,
    result: String(form.get(item.key) ?? fallback),
  };
}

function validateChecklistStep(form: FormData, step: number) {
  const missingField = requiredChecklistFieldsByStep[step]?.find(
    (field) => !String(form.get(field.name) ?? "").trim(),
  );
  return missingField
    ? `Preencha o campo obrigatorio: ${missingField.label}.`
    : undefined;
}

function checkItem(check?: ComplianceCheckRecord, key?: string) {
  return check?.items?.find((item) => item.key === key);
}

function checkItemValue(
  check: ComplianceCheckRecord | undefined,
  key: string,
  fallback = "",
) {
  return checkItem(check, key)?.result ?? fallback;
}

function checkItemNotes(check: ComplianceCheckRecord | undefined, key: string) {
  return checkItem(check, key)?.notes ?? "";
}

export function CompliancePage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentRecord>();
  const [editingCheck, setEditingCheck] = useState<ComplianceCheckRecord>();
  const [detailDocument, setDetailDocument] = useState<DocumentRecord>();
  const [documentEntityType, setDocumentEntityType] = useState("vehicle");
  const [formError, setFormError] = useState<string>();
  const [documentError, setDocumentError] = useState<string>();
  const [previewDocument, setPreviewDocument] = useState<{
    fileName: string;
    url: string;
  }>();
  const [detailCheck, setDetailCheck] = useState<ComplianceCheckRecord>();
  const [previewCheckAttachment, setPreviewCheckAttachment] = useState<{
    checkId: string;
    fileName: string;
    originalName: string;
    mimeType?: string;
    url: string;
  }>();
  const [checklistStep, setChecklistStep] = useState(0);
  const [checklistAttachments, setChecklistAttachments] = useState<File[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    entityType: "",
    documentStatus: "",
    documentType: "",
    checkStatus: "",
    vehicleId: "",
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["compliance-documents"],
    queryFn: () => listResource<DocumentRecord>("/compliance/documents"),
  });
  const { data: checksPage } = useQuery({
    queryKey: ["compliance-checks"],
    queryFn: () =>
      listResourcePage<ComplianceCheckRecord>("/compliance/checks", {
        page: 1,
        limit: 10,
        sortBy: "performedAt",
        sortDir: "desc",
      }),
  });
  const { data: allComplianceChecks = [] } = useQuery({
    queryKey: ["compliance-checks-all"],
    queryFn: () =>
      listAllResourcePages<ComplianceCheckRecord>("/compliance/checks", {
        sortBy: "performedAt",
        sortDir: "desc",
      }),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles(),
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => getDrivers(),
  });
  const createCheckMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const created = await createComplianceCheck(payload);
      const checklistId = String((created as { _id?: string })._id ?? "");
      if (checklistId && checklistAttachments.length > 0) {
        return uploadComplianceCheckAttachments(
          checklistId,
          checklistAttachments,
        );
      }
      return created;
    },
    onSuccess: async () => {
      closeChecklistModal();
      await queryClient.invalidateQueries({ queryKey: ["compliance-checks"] });
      await queryClient.invalidateQueries({ queryKey: ["compliance-checks-all"] });
      await queryClient.invalidateQueries({
        queryKey: ["compliance-documents"],
      });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(
          error,
          "Não foi possível salvar o checklist ou enviar os anexos.",
        ),
      ),
  });
  const updateCheckMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => {
      const updated = await updateComplianceCheck(id, payload);
      if (checklistAttachments.length > 0) {
        return uploadComplianceCheckAttachments(id, checklistAttachments);
      }
      return updated;
    },
    onSuccess: async () => {
      closeChecklistModal();
      await queryClient.invalidateQueries({ queryKey: ["compliance-checks"] });
      await queryClient.invalidateQueries({ queryKey: ["compliance-checks-all"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(
          error,
          "Não foi possível editar o checklist ou enviar os anexos.",
        ),
      ),
  });
  const createDocumentMutation = useMutation({
    mutationFn: createDocument,
    onSuccess: async () => {
      closeDocumentModal();
      await invalidateComplianceData();
    },
    onError: (error) =>
      setDocumentError(
        apiErrorMessage(error, "Não foi possível criar o documento."),
      ),
  });
  const updateDocumentMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => updateDocument(id, payload),
    onSuccess: async () => {
      closeDocumentModal();
      await invalidateComplianceData();
    },
    onError: (error) =>
      setDocumentError(
        apiErrorMessage(error, "Não foi possível editar o documento."),
      ),
  });
  const deleteDocumentMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: invalidateComplianceData,
    onError: (error) =>
      setDocumentError(
        apiErrorMessage(error, "Não foi possível excluir o documento."),
      ),
  });
  const deleteCheckMutation = useMutation({
    mutationFn: deleteComplianceCheck,
    onSuccess: async () => {
      setDetailCheck(undefined);
      await queryClient.invalidateQueries({ queryKey: ["compliance-checks"] });
      await queryClient.invalidateQueries({ queryKey: ["compliance-checks-all"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      setFormError(
        apiErrorMessage(error, "Não foi possível excluir o checklist."),
      ),
  });

  async function invalidateComplianceData() {
    await queryClient.invalidateQueries({ queryKey: ["compliance-documents"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function openDocumentCreateModal() {
    setEditingDocument(undefined);
    setDocumentEntityType("vehicle");
    setDocumentError(undefined);
    setIsDocumentModalOpen(true);
  }

  function openDocumentEditModal(document: DocumentRecord) {
    setEditingDocument(document);
    setDocumentEntityType(document.entityType);
    setDocumentError(undefined);
    setIsDocumentModalOpen(true);
  }

  function closeDocumentModal() {
    setEditingDocument(undefined);
    setDocumentError(undefined);
    setIsDocumentModalOpen(false);
  }

  function openChecklistModal() {
    setEditingCheck(undefined);
    setFormError(undefined);
    setChecklistStep(0);
    setChecklistAttachments([]);
    setIsModalOpen(true);
  }

  function openChecklistEditModal(check: ComplianceCheckRecord) {
    setDetailCheck(undefined);
    setEditingCheck(check);
    setFormError(undefined);
    setChecklistStep(0);
    setChecklistAttachments([]);
    setIsModalOpen(true);
  }

  function closeChecklistModal() {
    setFormError(undefined);
    setEditingCheck(undefined);
    setChecklistStep(0);
    setChecklistAttachments([]);
    setIsModalOpen(false);
  }

  async function openCheckAttachmentPreview(
    checkId: string,
    attachment: NonNullable<ComplianceCheckRecord["attachments"]>[number],
  ) {
    const blob = await fetchComplianceCheckAttachmentBlob(
      checkId,
      attachment.fileName,
    );
    setPreviewCheckAttachment({
      checkId,
      fileName: attachment.fileName,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      url: URL.createObjectURL(blob),
    });
  }

  function closeCheckAttachmentPreview() {
    if (previewCheckAttachment?.url) {
      URL.revokeObjectURL(previewCheckAttachment.url);
    }
    setPreviewCheckAttachment(undefined);
  }

  const vehicleOptions = vehicles.map((vehicle) => ({
    value: vehicle._id,
    label: `${vehicle.plate} - ${vehicle.nickname ? `${vehicle.nickname} | ` : ""}${vehicle.brand} ${vehicle.model}`,
    searchText: `${vehicle.plate} ${vehicle.nickname ?? ""} ${vehicle.brand} ${vehicle.model}`,
  }));
  const driverOptions = drivers.map((driver) => ({
    value: driver._id,
    label: `${driver.name}${driver.licenseNumber ? ` - CNH ${driver.licenseNumber}` : ""}`,
    searchText: `${driver.name} ${driver.licenseNumber} ${driver.licenseCategory}`,
  }));
  const documentTypeOptions = Object.entries(documentTypeLabels).map(([value, label]) => ({ value, label }));
  const entityTypeOptions = Object.entries(entityTypeLabels).map(([value, label]) => ({ value, label }));

  function vehicleLabel(vehicleId?: string) {
    if (!vehicleId) {
      return "-";
    }
    const vehicle = vehicles.find((item) => item._id === vehicleId);
    return vehicle
      ? `${vehicle.plate} - ${vehicle.nickname ?? vehicle.model}`
      : vehicleId;
  }

  function driverLabel(driverId?: string) {
    if (!driverId) {
      return "-";
    }
    return drivers.find((item) => item._id === driverId)?.name ?? driverId;
  }

  function buildChecklistPayload(form: FormData) {
    const vehicleId = String(form.get("vehicleId") ?? "");
    const driverId = String(form.get("driverId") ?? "");
    const deliveryOdometerKm = Number(form.get("deliveryOdometerKm") || 0);
    const deliveredAt =
      String(form.get("deliveredAt") ?? "") || new Date().toISOString();
    const conservationResults = conservationItems.map((item) =>
      selectedChecklistItemFromForm(
        form,
        item,
        "Condicoes de conservação",
        "bom",
      ),
    );
    const lightingResults = [
      ...rearLightingItems.map((item) =>
        selectedChecklistItemFromForm(form, item, "Iluminação traseira", "ok"),
      ),
      ...frontLightingItems.map((item) =>
        selectedChecklistItemFromForm(form, item, "Iluminação dianteira", "ok"),
      ),
    ];
    const functionalItems = [
      ...safetyChecklistItems.map((item) =>
        checklistItemFromForm(form, item, "Itens de seguranca"),
      ),
      ...motorChecklistItems.map((item) =>
        checklistItemFromForm(form, item, "Motor e sistemas associados"),
      ),
    ];
    const hasFailure =
      conservationResults.some((item) => item.result === "ruim") ||
      lightingResults.some((item) => item.result === "failed") ||
      functionalItems.some((item) => item.result === "failed");
    const bodyDamageNotes = String(form.get("bodyDamageNotes") ?? "").trim();
    const maintenanceNotes = String(form.get("maintenanceNotes") ?? "").trim();
    const responsibleName = String(form.get("responsibleName") ?? "").trim();
    const receivedBy = String(form.get("receivedBy") ?? "").trim();

    return {
      vehicleId,
      driverId: driverId || undefined,
      checklistVersion:
        String(form.get("checklistVersion") ?? "entrega-v1") || "entrega-v1",
      templateId: "vehicle-delivery",
      status: hasFailure ? "failed" : "passed",
      performedAt: deliveredAt,
      items: [
        {
          key: "delivery_odometer_km",
          label: "Km de entrega",
          section: "Identificação",
          result: "info",
          notes: deliveryOdometerKm ? `${deliveryOdometerKm} km` : "",
        },
        {
          key: "delivery_date",
          label: "Data da entrega",
          section: "Identificação",
          result: "info",
          notes: deliveredAt,
        },
        ...conservationResults,
        ...lightingResults,
        ...functionalItems,
        {
          key: "body_damage_notes",
          label: "Danos na funilaria",
          section: "Danos na funilaria",
          result: bodyDamageNotes ? "reported" : "ok",
          notes: bodyDamageNotes,
        },
        {
          key: "maintenance_observations",
          label: "Observações do veículo",
          section: "Observações",
          result: maintenanceNotes ? "reported" : "ok",
          notes: maintenanceNotes,
        },
        {
          key: "delivery_responsible",
          label: "Responsavel pela entrega",
          section: "Assinaturas",
          result: "info",
          notes: responsibleName,
        },
        {
          key: "received_by",
          label: "Recebido por",
          section: "Assinaturas",
          result: "info",
          notes: receivedBy,
        },
      ],
    };
  }

  const filteredDocuments = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return documents.filter((document) => {
      const entityLabel = document.entityType === "driver" ? driverLabel(document.entityId) : vehicleLabel(document.entityId);
      return (
        (!term || `${document.type} ${document.number ?? ""} ${entityLabel}`.toLowerCase().includes(term)) &&
        (!filters.entityType || document.entityType === filters.entityType) &&
        (!filters.documentStatus || document.status === filters.documentStatus) &&
        (!filters.documentType || document.type === filters.documentType)
      );
    });
  }, [documents, filters, vehicles, drivers]);
  const complianceChecks = useMemo(() => {
    const source = allComplianceChecks.length > 0 ? allComplianceChecks : (checksPage?.data ?? []);
    const term = filters.search.trim().toLowerCase();
    return source.filter((check) => (
      (!term || `${vehicleLabel(check.vehicleId)} ${driverLabel(check.driverId)} ${check.checklistVersion}`.toLowerCase().includes(term)) &&
      (!filters.checkStatus || check.status === filters.checkStatus) &&
      (!filters.vehicleId || check.vehicleId === filters.vehicleId)
    ));
  }, [allComplianceChecks, checksPage, filters, vehicles, drivers]);
  const complianceKpis = useMemo(() => {
    const validDocuments = filteredDocuments.filter(
      (document) => document.status === "valid",
    ).length;
    const documentCoverage = filteredDocuments.length
      ? Math.round((validDocuments / filteredDocuments.length) * 100)
      : 0;
    const failedChecks = complianceChecks.filter(
      (check) => check.status === "failed",
    ).length;
    const checkCoverage = complianceChecks.length
      ? Math.round(
          ((complianceChecks.length - failedChecks) / complianceChecks.length) *
            100,
        )
      : 0;
    const checkAttachments = complianceChecks.reduce(
      (total, check) => total + (check.attachments?.length ?? 0),
      0,
    );
    return [
      {
        label: "Documentos validos",
        value: filteredDocuments.length ? `${documentCoverage}%` : "0%",
        detail: `${validDocuments} de ${filteredDocuments.length} em conformidade`,
        icon: CheckCircle2,
        tone:
          documentCoverage >= 90
            ? "green"
            : documentCoverage >= 70
              ? "amber"
              : "red",
      },
      {
        label: "Checklists aprovados",
        value: complianceChecks.length ? `${checkCoverage}%` : "0%",
        detail: `${complianceChecks.length - failedChecks} de ${complianceChecks.length} aprovados`,
        icon: ShieldAlert,
        tone:
          checkCoverage >= 90 ? "green" : checkCoverage >= 70 ? "amber" : "red",
      },
      {
        label: "Anexos de checklists",
        value: String(checkAttachments),
        detail: `${complianceChecks.length} checklist(s) recentes`,
        icon: Paperclip,
        tone: "cyan",
      },
    ] as const;
  }, [complianceChecks, filteredDocuments]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold">Compliance</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Documentos, checklists, pendencias e trilha de auditoria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadResourceExport("documents")}
          >
            <Download size={18} />
            Documentos
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadResourceExport("compliance-checks")}
          >
            <Download size={18} />
            Checklists
          </Button>
          <Button variant="secondary" onClick={openDocumentCreateModal}>
            <FilePlus2 size={18} />
            Novo documento
          </Button>
          <Button onClick={openChecklistModal}>
            <CheckCircle2 size={18} />
            Novo checklist
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {complianceKpis.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            detail={item.detail}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_180px_180px_180px_180px_220px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-zinc-400" size={18} />
              <Input className="pl-10" placeholder="Buscar documento, veículo ou motorista" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
            </div>
            <SearchableSelect value={filters.entityType} onValueChange={(value) => setFilters((current) => ({ ...current, entityType: value }))} placeholder="Entidade" options={[{ value: "", label: "Todas" }, ...entityTypeOptions]} />
            <SearchableSelect value={filters.documentType} onValueChange={(value) => setFilters((current) => ({ ...current, documentType: value }))} placeholder="Tipo doc." searchPlaceholder="Buscar tipo" options={[{ value: "", label: "Todos" }, ...documentTypeOptions]} />
            <SearchableSelect value={filters.documentStatus} onValueChange={(value) => setFilters((current) => ({ ...current, documentStatus: value }))} placeholder="Status doc." options={[{ value: "", label: "Todos" }, { value: "valid", label: "Válido" }, { value: "expiring", label: "Vencendo" }, { value: "expired", label: "Vencido" }]} />
            <SearchableSelect value={filters.checkStatus} onValueChange={(value) => setFilters((current) => ({ ...current, checkStatus: value }))} placeholder="Status checklist" options={[{ value: "", label: "Todos" }, { value: "passed", label: "Aprovado" }, { value: "failed", label: "Reprovado" }, { value: "pending", label: "Pendente" }]} />
            <SearchableSelect value={filters.vehicleId} onValueChange={(value) => setFilters((current) => ({ ...current, vehicleId: value }))} placeholder="Veículo do checklist" searchPlaceholder="Buscar veículo" options={[{ value: "", label: "Todos os veículos" }, ...vehicleOptions]} />
            <Button variant="secondary" onClick={() => setFilters({ search: "", entityType: "", documentStatus: "", documentType: "", checkStatus: "", vehicleId: "" })}>
              <Filter size={18} />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(560px,680px)]">
        <Card>
          <CardHeader>
            <CardTitle>Documentos vencendo</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Entidade</Th>
                  <Th>Número</Th>
                  <Th>Vencimento</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((document) => (
                  <tr key={document._id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <FileWarning size={16} className="text-fleet-amber" />
                        <strong>
                          {labelFor(document.type, documentTypeLabels)}
                        </strong>
                      </div>
                    </Td>
                    <Td>{labelFor(document.entityType, entityTypeLabels)}</Td>
                    <Td>{document.number ?? "-"}</Td>
                    <Td>{formatDate(document.expiresAt)}</Td>
                    <Td>
                      <Badge
                        tone={
                          document.status === "expired"
                            ? "red"
                            : document.status === "expiring"
                              ? "amber"
                              : "green"
                        }
                      >
                        {labelFor(document.status)}
                      </Badge>
                    </Td>
                    <Td>
                      <ActionMenu
                        items={[
                          {
                            label: "Editar",
                            icon: <Edit2 size={15} />,
                            onClick: () => openDocumentEditModal(document),
                          },
                          {
                            label: "Detalhes",
                            icon: <Eye size={15} />,
                            onClick: () => setDetailDocument(document),
                          },
                          {
                            label: "Excluir",
                            icon: <Trash2 size={15} />,
                            danger: true,
                            disabled: deleteDocumentMutation.isPending,
                            onClick: () => {
                              if (
                                window.confirm(
                                  `Excluir o documento ${labelFor(document.type, documentTypeLabels)}?`,
                                )
                              ) {
                                deleteDocumentMutation.mutate(document._id);
                              }
                            },
                          },
                        ]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>Checklists recentes</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Entrega por veículo, status, anexos e ações rapidas.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-1">
            {complianceChecks.length === 0 && (
              <p className="text-sm text-zinc-500">
                Nenhum checklist registrado ainda.
              </p>
            )}
            {complianceChecks.slice(0, 6).map((check) => (
              <div
                key={check._id}
                className="rounded-lg border border-fleet-line bg-gradient-to-br from-white to-zinc-50 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-base">
                      {vehicleLabel(check.vehicleId)}
                    </strong>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {formatDate(check.performedAt)} -{" "}
                      {driverLabel(check.driverId)}
                    </span>
                  </div>
                  <Badge
                    tone={
                      check.status === "passed"
                        ? "green"
                        : check.status === "failed"
                          ? "red"
                          : "amber"
                    }
                  >
                    {labelFor(check.status)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span>{check.items?.length ?? 0} itens</span>
                  <span>{check.attachments?.length ?? 0} anexo(s)</span>
                  <span>{check.checklistVersion}</span>
                </div>
                <div className="mt-4 flex justify-end">
                  <ActionMenu
                    items={[
                      {
                        label: "Detalhes",
                        icon: <Eye size={15} />,
                        onClick: () => setDetailCheck(check),
                      },
                      {
                        label: "Editar",
                        icon: <Edit2 size={15} />,
                        onClick: () => openChecklistEditModal(check),
                      },
                      {
                        label: "Excluir",
                        icon: <Trash2 size={15} />,
                        danger: true,
                        disabled: deleteCheckMutation.isPending,
                        onClick: () => {
                          if (
                            window.confirm(
                              `Excluir checklist do veículo ${vehicleLabel(check.vehicleId)}?`,
                            )
                          ) {
                            deleteCheckMutation.mutate(check._id);
                          }
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Modal
        open={isDocumentModalOpen}
        title={editingDocument ? "Editar documento" : "Novo documento"}
        description="Cadastre vencimentos, numeros e anexos logicos de documentos da frota."
        onClose={closeDocumentModal}
      >
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setDocumentError(undefined);
            const form = new FormData(event.currentTarget);
            const payload = {
              entityType: documentEntityType,
              entityId: String(form.get("entityId") ?? ""),
              type: String(form.get("type") ?? ""),
              number: String(form.get("number") ?? ""),
              issuedAt: String(form.get("issuedAt") ?? "") || undefined,
              expiresAt: String(form.get("expiresAt") ?? "") || undefined,
              fileUrl: String(form.get("fileUrl") ?? ""),
            };
            if (!payload.entityId) {
              setDocumentError("Selecione a referencia do documento.");
              return;
            }
            if (editingDocument) {
              updateDocumentMutation.mutate({
                id: editingDocument._id,
                payload,
              });
              return;
            }
            createDocumentMutation.mutate(payload);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Entidade
              <SearchableSelect
                value={documentEntityType}
                onValueChange={setDocumentEntityType}
                options={[
                  { value: "vehicle", label: "Veículo" },
                  { value: "driver", label: "Motorista" },
                ]}
                searchPlaceholder="Buscar entidade"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Referencia
              <SearchableSelect
                name="entityId"
                defaultValue={editingDocument?.entityId ?? ""}
                required
                placeholder="Selecione"
                searchPlaceholder={
                  documentEntityType === "vehicle"
                    ? "Buscar placa, modelo ou apelido"
                    : "Buscar motorista ou CNH"
                }
                options={
                  documentEntityType === "vehicle"
                    ? vehicleOptions
                    : driverOptions
                }
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Tipo
              <Input
                name="type"
                placeholder="CRLV, seguro, licenciamento"
                defaultValue={editingDocument?.type}
                required
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Número
              <Input
                name="number"
                placeholder="Número do documento"
                defaultValue={editingDocument?.number}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Emissão
              <Input
                name="issuedAt"
                type="date"
                defaultValue={editingDocument?.issuedAt?.slice(0, 10)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Vencimento
              <Input
                name="expiresAt"
                type="date"
                defaultValue={editingDocument?.expiresAt?.slice(0, 10)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              URL do arquivo
              <Input
                name="fileUrl"
                placeholder="https://..."
                defaultValue={editingDocument?.fileUrl}
              />
            </label>
          </div>
          {documentError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {documentError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDocumentModal}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                createDocumentMutation.isPending ||
                updateDocumentMutation.isPending
              }
            >
              {createDocumentMutation.isPending ||
              updateDocumentMutation.isPending
                ? "Salvando..."
                : "Salvar documento"}
            </Button>
          </div>
        </form>
      </Modal>

      <DetailModal
        open={Boolean(detailDocument)}
        entityId={detailDocument?._id}
        title="Detalhes do documento"
        description="Informacoes documentais, vencimento e trilha de auditoria."
        onClose={() => setDetailDocument(undefined)}
        fields={[
          {
            label: "Tipo",
            value: labelFor(detailDocument?.type, documentTypeLabels),
          },
          {
            label: "Entidade",
            value: labelFor(detailDocument?.entityType, entityTypeLabels),
          },
          {
            label: "Referencia",
            value: detailDocument
              ? detailDocument.entityType === "driver"
                ? (drivers.find(
                    (driver) => driver._id === detailDocument.entityId,
                  )?.name ?? detailDocument.entityId)
                : (vehicles.find(
                    (vehicle) => vehicle._id === detailDocument.entityId,
                  )?.plate ?? detailDocument.entityId)
              : undefined,
          },
          { label: "Número", value: detailDocument?.number },
          { label: "Emissão", value: formatDate(detailDocument?.issuedAt) },
          { label: "Vencimento", value: formatDate(detailDocument?.expiresAt) },
          { label: "Status", value: labelFor(detailDocument?.status) },
          { label: "Arquivo", value: detailDocument?.fileUrl },
        ]}
      >
        {detailDocument?.fileUrl && (
          <div className="rounded-lg border border-fleet-line p-4">
            <strong className="block text-sm text-fleet-ink">Arquivo</strong>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2">
              <span className="break-all text-sm text-zinc-600">
                {detailDocument.fileUrl}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPreviewDocument({
                    fileName:
                      detailDocument.fileUrl?.split("/").pop() ||
                      detailDocument.type,
                    url: detailDocument.fileUrl ?? "",
                  })
                }
              >
                <Eye size={15} />
                Previsualizar
              </Button>
            </div>
          </div>
        )}
      </DetailModal>

      <AttachmentPreviewModal
        open={Boolean(previewDocument)}
        title="Previsualizar documento"
        fileName={previewDocument?.fileName ?? ""}
        url={previewDocument?.url}
        onClose={() => setPreviewDocument(undefined)}
        onDownload={() => {
          if (previewDocument) {
            downloadExternalFile(previewDocument.url, previewDocument.fileName);
          }
        }}
      />

      <DetailModal
        open={Boolean(detailCheck)}
        entityId={detailCheck?._id}
        title="Detalhes do checklist"
        description="Itens avaliados, anexos e trilha de auditoria."
        onClose={() => setDetailCheck(undefined)}
        fields={[
          { label: "Veículo", value: vehicleLabel(detailCheck?.vehicleId) },
          { label: "Motorista", value: driverLabel(detailCheck?.driverId) },
          { label: "Status", value: labelFor(detailCheck?.status) },
          { label: "Versao", value: detailCheck?.checklistVersion },
          { label: "Data", value: formatDate(detailCheck?.performedAt) },
          { label: "Itens", value: detailCheck?.items?.length ?? 0 },
          { label: "Anexos", value: detailCheck?.attachments?.length ?? 0 },
        ]}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-fleet-line p-4">
            <strong className="block text-sm text-fleet-ink">
              Itens avaliados
            </strong>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {(detailCheck?.items ?? []).map((item) => (
                <div
                  key={`${item.key}-${item.label}`}
                  className="rounded-md border border-fleet-line px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-medium text-fleet-ink">
                      {item.label}
                    </span>
                    <Badge
                      tone={
                        item.result === "ok" || item.result === "bom"
                          ? "green"
                          : item.result === "failed" || item.result === "ruim"
                            ? "red"
                            : "amber"
                      }
                    >
                      {labelFor(item.result ?? "info")}
                    </Badge>
                  </div>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {item.section ?? "-"}
                  </span>
                  {item.notes && (
                    <p className="mt-1 text-xs text-zinc-600">{item.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-fleet-line p-4">
            <strong className="block text-sm text-fleet-ink">Anexos</strong>
            <div className="mt-3 space-y-2">
              {(detailCheck?.attachments?.length ?? 0) === 0 && (
                <p className="text-sm text-zinc-500">
                  Nenhum anexo enviado para este checklist.
                </p>
              )}
              {detailCheck?.attachments?.map((attachment) => (
                <button
                  key={attachment.fileName}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-fleet-line px-3 py-2 text-left text-sm transition hover:bg-zinc-50"
                  onClick={() =>
                    openCheckAttachmentPreview(detailCheck._id, attachment)
                  }
                >
                  <span className="min-w-0 truncate font-medium text-fleet-ink">
                    {attachment.originalName}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    Previsualizar
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => detailCheck && openChecklistEditModal(detailCheck)}
          >
            <Edit2 size={15} />
            Editar checklist
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={deleteCheckMutation.isPending}
            onClick={() => {
              if (
                detailCheck &&
                window.confirm(
                  `Excluir checklist do veículo ${vehicleLabel(detailCheck.vehicleId)}?`,
                )
              ) {
                deleteCheckMutation.mutate(detailCheck._id);
              }
            }}
          >
            <Trash2 size={15} />
            Excluir checklist
          </Button>
        </div>
      </DetailModal>

      <AttachmentPreviewModal
        open={Boolean(previewCheckAttachment)}
        title="Previsualizar anexo"
        fileName={previewCheckAttachment?.originalName ?? ""}
        mimeType={previewCheckAttachment?.mimeType}
        url={previewCheckAttachment?.url}
        onClose={closeCheckAttachmentPreview}
        onDownload={() => {
          if (previewCheckAttachment) {
            downloadComplianceCheckAttachment(
              previewCheckAttachment.checkId,
              previewCheckAttachment,
            );
          }
        }}
      />

      <Modal
        open={isModalOpen}
        title={
          editingCheck ? "Editar checklist de entrega" : "Checklist de entrega"
        }
        description="Avance por cada etapa do checklist e finalize com anexos quando necessario."
        size="xl"
        onClose={closeChecklistModal}
      >
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {checklistSteps.map((step, index) => (
              <button
                key={step}
                type="button"
                disabled={index > checklistStep}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  checklistStep === index
                    ? "border-fleet-green bg-emerald-50 text-fleet-green"
                    : index < checklistStep
                      ? "border-emerald-100 bg-white text-fleet-ink"
                      : "cursor-not-allowed border-fleet-line bg-white text-zinc-400"
                }`}
                onClick={() => setChecklistStep(index)}
              >
                {index + 1}. {step}
              </button>
            ))}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-fleet-green transition-all"
              style={{
                width: `${((checklistStep + 1) / checklistSteps.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <form
          className="space-y-5"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setFormError(undefined);
            const form = new FormData(event.currentTarget);
            const currentStepError = validateChecklistStep(form, checklistStep);
            if (currentStepError) {
              setFormError(currentStepError);
              return;
            }
            if (checklistStep < checklistSteps.length - 1) {
              setChecklistStep((current) =>
                Math.min(current + 1, checklistSteps.length - 1),
              );
              return;
            }
            const payload = buildChecklistPayload(form);
            if (!payload.vehicleId) {
              setFormError(
                "Selecione o veículo pela placa para realizar o checklist.",
              );
              return;
            }
            if (editingCheck) {
              updateCheckMutation.mutate({ id: editingCheck._id, payload });
              return;
            }
            createCheckMutation.mutate(payload);
          }}
        >
          <div
            className={
              checklistStep === 0 ? "grid gap-4 md:grid-cols-2" : "hidden"
            }
          >
            <label className="space-y-2 text-sm font-medium md:col-span-2">
              Veículo
              <SearchableSelect
                name="vehicleId"
                defaultValue={editingCheck?.vehicleId ?? ""}
                required
                placeholder="Selecione o veículo"
                searchPlaceholder="Buscar placa, modelo ou apelido"
                options={vehicleOptions}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Motorista
              <SearchableSelect
                name="driverId"
                defaultValue={editingCheck?.driverId ?? ""}
                placeholder="Condutor responsavel"
                searchPlaceholder="Buscar motorista ou CNH"
                options={[
                  { value: "", label: "Não informado" },
                  ...driverOptions,
                ]}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Km de entrega
              <Input
                name="deliveryOdometerKm"
                type="number"
                min="0"
                placeholder="Ex.: 125000"
                defaultValue={checkItemNotes(
                  editingCheck,
                  "delivery_odometer_km",
                ).replace(/\D/g, "")}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Data da entrega
              <Input
                name="deliveredAt"
                type="datetime-local"
                defaultValue={(
                  editingCheck?.performedAt ?? new Date().toISOString()
                ).slice(0, 16)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Versao
              <Input
                name="checklistVersion"
                defaultValue={editingCheck?.checklistVersion ?? "entrega-v1"}
              />
            </label>
          </div>

          <div className={checklistStep === 1 ? "block" : "hidden"}>
            <SelectChecklistSection
              title="Condicoes de conservação"
              check={editingCheck}
              items={conservationItems}
              options={conservationOptions}
              searchPlaceholder="Buscar condicao"
              searchable={false}
            />
          </div>
          <div className={checklistStep === 2 ? "block" : "hidden"}>
            <SelectChecklistSection
              title="Iluminação traseira"
              check={editingCheck}
              items={rearLightingItems}
              options={lightingOptions}
              searchPlaceholder="Buscar funcionamento"
              searchable={false}
            />
          </div>
          <div className={checklistStep === 3 ? "block" : "hidden"}>
            <SelectChecklistSection
              title="Iluminação dianteira"
              check={editingCheck}
              items={frontLightingItems}
              options={lightingOptions}
              searchPlaceholder="Buscar funcionamento"
              searchable={false}
            />
          </div>
          <div className={checklistStep === 4 ? "block" : "hidden"}>
            <ChecklistSection
              title="Itens de seguranca"
              check={editingCheck}
              items={safetyChecklistItems}
            />
          </div>
          <div className={checklistStep === 5 ? "block" : "hidden"}>
            <ChecklistSection
              title="Motor e sistemas associados"
              check={editingCheck}
              items={motorChecklistItems}
            />
          </div>

          <div
            className={
              checklistStep === 6 ? "grid gap-4 md:grid-cols-2" : "hidden"
            }
          >
            <label className="space-y-2 text-sm font-medium">
              Danos na funilaria
              <Textarea
                name="bodyDamageNotes"
                defaultValue={checkItemNotes(editingCheck, "body_damage_notes")}
                placeholder="Informe local, número e descrição do dano. Ex.: porta esquerda riscada, para-choque amassado."
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Observações do veículo
              <Textarea
                name="maintenanceNotes"
                defaultValue={checkItemNotes(
                  editingCheck,
                  "maintenance_observations",
                )}
                placeholder="Descreva manutenções necessárias ou observações da entrega."
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Responsavel pela entrega
              <Input
                name="responsibleName"
                defaultValue={checkItemNotes(
                  editingCheck,
                  "delivery_responsible",
                )}
                placeholder="Nome de quem entregou"
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              Recebido por
              <Input
                name="receivedBy"
                placeholder="Nome de quem recebeu"
                defaultValue={checkItemNotes(editingCheck, "received_by")}
              />
            </label>
          </div>

          <div className={checklistStep === 7 ? "space-y-4" : "hidden"}>
            <div className="rounded-lg border border-fleet-line bg-zinc-50/60 p-4">
              <div className="flex items-start gap-3">
                <Paperclip className="mt-0.5 text-fleet-green" size={18} />
                <div>
                  <strong className="block text-sm text-fleet-ink">
                    Anexos do checklist
                  </strong>
                  <p className="mt-1 text-sm text-zinc-500">
                    Adicione fotos do veículo, danos, documentos assinados ou
                    comprovantes. É possível selecionar mais de um arquivo.
                  </p>
                </div>
              </div>
              <Input
                className="mt-4"
                type="file"
                multiple
                accept="image/*,.pdf,.xml,.txt,.csv,.xlsx"
                onChange={(event) =>
                  setChecklistAttachments(Array.from(event.target.files ?? []))
                }
              />
              {checklistAttachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {checklistAttachments.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-fleet-line bg-white px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-fleet-ink">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {formError && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeChecklistModal}
            >
              Cancelar
            </Button>
            {checklistStep > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setChecklistStep((current) => Math.max(current - 1, 0))
                }
              >
                <ArrowLeft size={16} />
                Voltar
              </Button>
            )}
            {checklistStep < checklistSteps.length - 1 ? (
              <Button type="submit">
                Avancar
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button type="submit" disabled={createCheckMutation.isPending}>
                {createCheckMutation.isPending
                  ? "Salvando..."
                  : "Salvar checklist"}
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ChecklistSection({
  title,
  check,
  items,
}: {
  title: string;
  check?: ComplianceCheckRecord;
  items: Array<{ key: string; label: string }>;
}) {
  return (
    <section className="rounded-lg border border-fleet-line bg-zinc-50/60 p-4">
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
        <strong className="text-sm text-fleet-ink">{title}</strong>
        <span className="text-xs text-zinc-500">
          Deixe marcado apenas o que esta funcionando
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex min-h-10 items-center gap-2 rounded-md border border-fleet-line bg-white px-3 py-2 text-sm font-medium text-fleet-ink shadow-sm transition hover:border-fleet-green/50 hover:bg-emerald-50/50"
          >
            <input
              name={item.key}
              type="checkbox"
              defaultChecked={
                checkItemValue(check, item.key, "ok") !== "failed"
              }
              className="h-4 w-4 accent-fleet-green"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function SelectChecklistSection({
  title,
  check,
  items,
  options,
  searchPlaceholder,
  searchable = true,
}: {
  title: string;
  check?: ComplianceCheckRecord;
  items: Array<{ key: string; label: string }>;
  options: Array<{ value: string; label: string }>;
  searchPlaceholder: string;
  searchable?: boolean;
}) {
  return (
    <section className="rounded-lg border border-fleet-line bg-zinc-50/60 p-4">
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
        <strong className="text-sm text-fleet-ink">{title}</strong>
        <span className="text-xs text-zinc-500">
          Campo pesquisavel dentro da selecao
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <label key={item.key} className="space-y-2 text-sm font-medium">
            {item.label}
            <SearchableSelect
              name={item.key}
              defaultValue={checkItemValue(
                check,
                item.key,
                options[0]?.value ?? "",
              )}
              options={options}
              searchPlaceholder={searchPlaceholder}
              searchable={searchable}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
