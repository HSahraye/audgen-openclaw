"use client";

import { useMemo, useState, useTransition } from "react";
import { archiveTemplateAction, duplicateTemplateAction, saveTemplateAction, seedSystemTemplatesAction } from "@/app/actions/templates";
import { updateWorkspaceBrandingAction } from "@/app/actions/workspace";
import { BaseTemplateConfigSchema } from "@/lib/templates/types";
import { TemplatesEmptyState } from "@/app/templates/templates-empty-state";

type Kind = "audit" | "outreach" | "offer";

type TemplateItem = {
  id: string;
  name: string;
  category: string | null;
  isDefault: boolean;
  isActive: boolean;
  archived: boolean;
  version: number;
  contentJson: string;
};

type TemplateByKind = Record<Kind, TemplateItem[]>;

export function TemplateManager({
  templates,
  workspaceSettings,
  workspace,
}: {
  templates: TemplateByKind;
  workspaceSettings: {
    publicCompanyName: string;
    brandName: string;
    senderIdentity: string;
    ctaLabelPrimary: string;
    ctaLabelSecondary: string;
    auditIntroCopy: string;
    auditOutroCopy: string;
    primaryColor: string;
    accentColor: string;
    typography: string;
    footerContent: string;
  };
  workspace: {
    customDomain: string;
    auditSubdomain: string;
  };
}) {
  const [kind, setKind] = useState<Kind>("audit");
  const [selectedId, setSelectedId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const currentList = templates[kind];
  const selectedTemplate = currentList.find((item) => item.id === selectedId) || currentList[0];
  const allEmpty = templates.audit.length === 0 && templates.outreach.length === 0 && templates.offer.length === 0;

  const initialConfig = useMemo(() => {
    if (selectedTemplate) return selectedTemplate.contentJson;
    return JSON.stringify(BaseTemplateConfigSchema.parse({}), null, 2);
  }, [selectedTemplate]);
  const previewConfig = useMemo(() => {
    try {
      return JSON.parse(initialConfig) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [initialConfig]);

  const save = (formData: FormData) => {
    startTransition(async () => {
      setError("");
      setSaveMessage("");
      const result = await saveTemplateAction(formData);
      if (!result.ok) {
        setError(result.error || "Could not save template.");
        return;
      }
      setSaveMessage("Template saved.");
      window.location.reload();
    });
  };

  const duplicate = (id: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("kind", kind);
      await duplicateTemplateAction(formData);
      window.location.reload();
    });
  };

  const archive = (id: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("kind", kind);
      await archiveTemplateAction(formData);
      window.location.reload();
    });
  };

  const saveBranding = (formData: FormData) => {
    startTransition(async () => {
      setError("");
      const result = await updateWorkspaceBrandingAction(formData);
      if (!result.ok) {
        setError(result.error || "Could not update workspace branding.");
        return;
      }
      setSaveMessage("Branding settings saved.");
      window.location.reload();
    });
  };
  const seedTemplates = () => {
    startTransition(async () => {
      const result = await seedSystemTemplatesAction();
      if (!result.ok) {
        setError(result.error || "Could not seed templates.");
        return;
      }
      window.location.reload();
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Template Type</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["audit", "outreach", "offer"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setKind(value);
                  setSelectedId("");
                }}
                className={`h-9 rounded-xl text-xs font-black uppercase ${kind === value ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Templates</p>
          <button
            type="button"
            onClick={seedTemplates}
            disabled={isPending}
            className="mt-2 h-8 rounded-lg border border-slate-200 px-2 text-[11px] font-black uppercase tracking-[0.08em] text-slate-700 disabled:opacity-60"
          >
            Seed system templates
          </button>
          <div className="mt-3 space-y-2">
            {currentList.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                No {kind} templates saved. Seed system templates above, or edit the JSON config on the right to save your first one.
              </p>
            ) : null}
            {currentList.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-xl border p-2 text-left ${selectedTemplate?.id === item.id ? "border-lime-300 bg-lime-50" : "border-slate-200 bg-white"}`}
              >
                <p className="text-xs font-black text-slate-800">{item.name}</p>
                <p className="text-[11px] text-slate-500">{item.category || "all categories"} · v{item.version}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="space-y-5">
        {allEmpty ? <TemplatesEmptyState /> : null}
        <form action={save} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Template Editor ({kind})</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="id" defaultValue={selectedTemplate?.id || ""} type="hidden" />
            <input name="kind" defaultValue={kind} type="hidden" />
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Name
              <input name="name" defaultValue={selectedTemplate?.name || ""} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" required />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Category (optional)
              <input name="category" defaultValue={selectedTemplate?.category || ""} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-black text-slate-600">
              <input name="isDefault" type="checkbox" defaultChecked={selectedTemplate?.isDefault || false} value="true" />
              Default template
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-black text-slate-600">
              <input name="isActive" type="checkbox" defaultChecked={selectedTemplate?.isActive ?? true} value="true" />
              Active
            </label>
          </div>
          <label className="mt-3 block text-xs font-black text-slate-600">
            JSON config
            <textarea name="contentJson" defaultValue={initialConfig} rows={18} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-mono text-xs" required />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={isPending} className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-60">
              Save template
            </button>
            {selectedTemplate ? (
              <>
                <button type="button" disabled={isPending} onClick={() => duplicate(selectedTemplate.id)} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700">
                  Duplicate
                </button>
                <button type="button" disabled={isPending} onClick={() => archive(selectedTemplate.id)} className="h-10 rounded-xl border border-rose-200 px-4 text-xs font-black text-rose-700">
                  Archive
                </button>
              </>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Preview Mode</p>
          {previewConfig ? (
            <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(previewConfig, null, 2)}</pre>
          ) : (
            <p className="mt-3 text-sm text-rose-600">Invalid JSON config; preview unavailable.</p>
          )}
        </div>

        <form action={saveBranding} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Workspace Branding + White Label</p>
          <p className="mt-2 text-xs text-slate-500">
            Used in SMS, emails, audits, proposals, and public-facing copy. This should be your agency/client-facing brand, not the internal workspace name.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Public company name
              <input name="publicCompanyName" defaultValue={workspaceSettings.publicCompanyName || "AuditGen"} placeholder="AuditGen" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-600">
              Internal brand label (optional)
              <input name="brandName" defaultValue={workspaceSettings.brandName} placeholder="Internal workspace label" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            </label>
            <input name="senderIdentity" defaultValue={workspaceSettings.senderIdentity} placeholder="Sender identity" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="primaryColor" defaultValue={workspaceSettings.primaryColor} placeholder="#84cc16" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="accentColor" defaultValue={workspaceSettings.accentColor} placeholder="#0f172a" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="typography" defaultValue={workspaceSettings.typography} placeholder="Inter" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="footerContent" defaultValue={workspaceSettings.footerContent} placeholder="Footer text" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="ctaLabelPrimary" defaultValue={workspaceSettings.ctaLabelPrimary} placeholder="Primary CTA label" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="ctaLabelSecondary" defaultValue={workspaceSettings.ctaLabelSecondary} placeholder="Secondary CTA label" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="customDomain" defaultValue={workspace.customDomain} placeholder="audit.youragency.com" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
            <input name="auditSubdomain" defaultValue={workspace.auditSubdomain} placeholder="youragency-audits" className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold" />
          </div>
          <textarea name="auditIntroCopy" defaultValue={workspaceSettings.auditIntroCopy} rows={3} placeholder="Audit intro copy" className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm" />
          <textarea name="auditOutroCopy" defaultValue={workspaceSettings.auditOutroCopy} rows={3} placeholder="Audit outro copy" className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" />
          <button disabled={isPending} className="mt-3 h-10 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-60">
            Save branding settings
          </button>
          {error ? <p className="mt-2 text-sm font-bold text-rose-600">{error}</p> : null}
          {saveMessage ? <p className="mt-2 text-sm font-bold text-lime-700">{saveMessage}</p> : null}
        </form>
      </section>
    </div>
  );
}
