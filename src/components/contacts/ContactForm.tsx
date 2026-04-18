import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { useCreateContact, useUpdateContact } from "@/hooks/useContacts";
import { CONTACT_STATUSES, CONTACT_SOURCES } from "@/lib/constants";
import type { Contact } from "@/types/crm";

const contactSchema = z.object({
  first_name: z.string().min(1, "שם פרטי הוא שדה חובה"),
  last_name: z.string().min(1, "שם משפחה הוא שדה חובה"),
  email: z.string().email("מייל לא תקין").or(z.literal("")).optional(),
  phone: z.string().optional(),
  whatsapp_phone: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  source: z.string().optional(),
  status: z.string().default("new"),
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
  const isEditing = !!contact;

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
          whatsapp_phone: contact.whatsapp_phone || "",
          company: contact.company || "",
          job_title: contact.job_title || "",
          source: contact.source || "",
          status: contact.status || "new",
          city: contact.city || "",
          notes: contact.notes || "",
        }
      : { status: "new" },
  });

  const onSubmit = async (data: ContactFormData) => {
    if (isEditing) {
      await updateContact.mutateAsync({ id: contact.id, ...data } as any);
    } else {
      await createContact.mutateAsync(data as any);
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
            {isEditing ? "עריכת איש קשר" : "איש קשר חדש"}
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

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="text-sm font-medium mb-1 block">WhatsApp</label>
              <input
                {...register("whatsapp_phone")}
                type="tel"
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="972501234567"
                dir="ltr"
              />
            </div>
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

          {/* Status & Source */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">סטטוס</label>
              <select
                {...register("status")}
                className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background"
              >
                {CONTACT_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
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
              {isSubmitting ? "שומר..." : isEditing ? "עדכון" : "צור איש קשר"}
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
