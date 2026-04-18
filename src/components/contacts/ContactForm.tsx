import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateContact, useUpdateContact } from "@/hooks/useContacts";
import { usePipelines } from "@/hooks/useDeals";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { CONTACT_SOURCES } from "@/lib/constants";
import type { Contact } from "@/types/crm";

const contactSchema = z.object({
  first_name: z.string().min(1, "שם פרטי הוא שדה חובה"),
  last_name: z.string().min(1, "שם משפחה הוא שדה חובה"),
  email: z.string().email("מייל לא תקין").or(z.literal("")).optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  source: z.string().optional(),
  stage_id: z.string().optional(),
  assigned_to: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  contact?: Contact;
  onClose: () => void;
}

export default function ContactForm({ contact, onClose }: ContactFormProps) {
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const { data: pipelines } = usePipelines();
  const { members } = useTeamMembers();
  const isEditing = !!contact;

  const defaultPipeline = pipelines?.find(p => p.is_default) || pipelines?.[0];
  const firstStageId = defaultPipeline?.default_stage_id || defaultPipeline?.stages?.[0]?.id || "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: contact
      ? {
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email || "",
          phone: contact.phone || "",
          company: contact.company || "",
          job_title: contact.job_title || "",
          source: contact.source || "",
          stage_id: contact.stage_id || firstStageId,
          assigned_to: contact.assigned_to || "",
          city: contact.city || "",
          notes: contact.notes || "",
        }
      : { stage_id: firstStageId },
  });

  const onSubmit = async (data: ContactFormData) => {
    const payload = { ...data, assigned_to: data.assigned_to || null };
    if (isEditing) {
      await updateContact.mutateAsync({ id: contact.id, ...payload } as any);
    } else {
      await createContact.mutateAsync({ ...payload, stage_id: data.stage_id || firstStageId } as any);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 w-full max-w-lg bg-card shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">
            {isEditing ? "עריכת ליד" : "ליד חדש"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">שם פרטי *</label>
              <input
                {...register("first_name")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="שם פרטי"
              />
              {errors.first_name && (
                <p className="text-xs text-destructive mt-1">{errors.first_name.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">שם משפחה *</label>
              <input
                {...register("last_name")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="שם משפחה"
              />
              {errors.last_name && (
                <p className="text-xs text-destructive mt-1">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Contact info */}
          <div>
            <label className="text-sm font-medium mb-1 block">מייל</label>
            <input
              {...register("email")}
              type="email"
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="email@example.com"
              dir="ltr"
            />
            {errors.email && (
              <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">טלפון</label>
            <input
              {...register("phone")}
              type="tel"
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="050-000-0000"
              dir="ltr"
            />
          </div>

          {/* Company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">חברה</label>
              <input
                {...register("company")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="שם חברה"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">תפקיד</label>
              <input
                {...register("job_title")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="תפקיד"
              />
            </div>
          </div>

          {/* Stage & Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">שלב</label>
              <select
                {...register("stage_id")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
              >
                {pipelines?.map(p => (
                  <optgroup key={p.id} label={pipelines.length > 1 ? p.name : undefined}>
                    {p.stages?.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">מקור</label>
              <select
                {...register("source")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
              >
                <option value="">בחר מקור</option>
                {CONTACT_SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="text-sm font-medium mb-1 block">אחראי</label>
            <select
              {...register("assigned_to")}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
            >
              <option value="">ללא שיוך</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.display_name}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label className="text-sm font-medium mb-1 block">עיר</label>
            <input
              {...register("city")}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="עיר"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-1 block">הערות</label>
            <textarea
              {...register("notes")}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="הערות נוספות..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "שומר..." : isEditing ? "עדכון" : "צור ליד"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium border border-input rounded-lg hover:bg-secondary transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
