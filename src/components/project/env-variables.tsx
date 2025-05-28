"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface EnvVariable {
  id: string;
  key: string;
  value: string;
  target: string[];
  createdAt: string;
  updatedAt: string;
}

interface EnvVariablesProps {
  projectId: string;
}

const envVariableSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z_][A-Z0-9_]*$/, {
    message: "Key büyük harf, rakam ve alt çizgi içerebilir",
  }),
  value: z.string().min(1, "Değer gereklidir"),
  target: z.object({
    development: z.boolean(),
    preview: z.boolean(),
    production: z.boolean(),
  }).refine((data) => data.development || data.preview || data.production, {
    message: "En az bir ortam seçmelisiniz",
  }),
});

type FormData = z.infer<typeof envVariableSchema>;

export function EnvVariables({ projectId }: EnvVariablesProps) {
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(envVariableSchema),
    defaultValues: {
      target: {
        development: true,
        preview: true,
        production: true,
      },
    },
  });

  // Environment variables'ları yükle
  useEffect(() => {
    fetchVariables();
  }, [projectId]);

  const fetchVariables = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/env`);
      if (response.ok) {
        const data = await response.json();
        setVariables(data.envVariables);
      }
    } catch (error) {
      console.error("Environment variables yüklenemedi:", error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const target = [];
      if (data.target.development) target.push("development");
      if (data.target.preview) target.push("preview");
      if (data.target.production) target.push("production");

      const payload = {
        key: data.key,
        value: data.value,
        target,
      };

      let response;
      if (editingId) {
        // Güncelleme
        response = await fetch(`/api/projects/${projectId}/env`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, envId: editingId }),
        });
      } else {
        // Yeni ekleme
        response = await fetch(`/api/projects/${projectId}/env`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        await fetchVariables();
        reset();
        setShowForm(false);
        setEditingId(null);
      } else {
        const error = await response.json();
        alert(error.error || "Bir hata oluştu");
      }
    } catch (error) {
      console.error("Environment variable kaydedilemedi:", error);
      alert("Bir hata oluştu");
    }
  };

  const handleEdit = (variable: EnvVariable) => {
    setEditingId(variable.id);
    setValue("key", variable.key);
    setValue("value", variable.value);
    setValue("target.development", variable.target.includes("development"));
    setValue("target.preview", variable.target.includes("preview"));
    setValue("target.production", variable.target.includes("production"));
    setShowForm(true);
  };

  const handleDelete = async (id: string, key: string) => {
    if (!confirm(`"${key}" environment variable'ını silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/env?envId=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchVariables();
      } else {
        alert("Silme işlemi başarısız oldu");
      }
    } catch (error) {
      console.error("Environment variable silinemedi:", error);
      alert("Bir hata oluştu");
    }
  };

  const toggleShowValue = (id: string) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <div className="text-center py-8">Yükleniyor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Environment Variables</h3>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) {
              reset();
              setEditingId(null);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "İptal" : "Yeni Ekle"}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Key</label>
            <Input
              {...register("key")}
              placeholder="DATABASE_URL"
              className="bg-black border-gray-700"
              disabled={!!editingId}
            />
            {errors.key && (
              <p className="text-red-500 text-sm mt-1">{errors.key.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Value</label>
            <Input
              {...register("value")}
              type="password"
              placeholder="Değer"
              className="bg-black border-gray-700"
            />
            {errors.value && (
              <p className="text-red-500 text-sm mt-1">{errors.value.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Ortamlar</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("target.development")}
                  className="rounded border-gray-700"
                />
                <span>Development</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("target.preview")}
                  className="rounded border-gray-700"
                />
                <span>Preview</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("target.production")}
                  className="rounded border-gray-700"
                />
                <span>Production</span>
              </label>
            </div>
            {errors.target && (
              <p className="text-red-500 text-sm mt-1">{errors.target.message}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? "Kaydediliyor..." : editingId ? "Güncelle" : "Ekle"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                reset();
                setEditingId(null);
              }}
              className="border-gray-700 hover:bg-gray-800"
            >
              İptal
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {variables.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
            <p className="text-gray-400">Henüz environment variable eklenmemiş</p>
          </div>
        ) : (
          variables.map((variable) => (
            <div
              key={variable.id}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-medium">{variable.key}</span>
                    <div className="flex gap-2">
                      {variable.target.map((env) => (
                        <span
                          key={env}
                          className="text-xs px-2 py-1 bg-gray-800 rounded"
                        >
                          {env}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-sm text-gray-400 font-mono">
                      {showValues[variable.id] ? variable.value : "••••••••"}
                    </code>
                    <button
                      onClick={() => toggleShowValue(variable.id)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {showValues[variable.id] ? "Gizle" : "Göster"}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(variable)}
                    className="border-gray-700 hover:bg-gray-800"
                  >
                    Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(variable.id, variable.key)}
                    className="border-red-700 text-red-500 hover:bg-red-950"
                  >
                    Sil
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 