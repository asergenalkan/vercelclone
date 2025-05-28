"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  framework: string;
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  rootDirectory: string | null;
  nodeVersion: string | null;
}

interface ProjectSettingsProps {
  project: Project;
}

const projectSettingsSchema = z.object({
  name: z.string().min(1, "Proje adı gereklidir"),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  installCommand: z.string().optional(),
  rootDirectory: z.string().optional(),
  nodeVersion: z.string().optional(),
});

type FormData = z.infer<typeof projectSettingsSchema>;

export function ProjectSettings({ project }: ProjectSettingsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: {
      name: project.name,
      buildCommand: project.buildCommand || "",
      outputDirectory: project.outputDirectory || "",
      installCommand: project.installCommand || "",
      rootDirectory: project.rootDirectory || "",
      nodeVersion: project.nodeVersion || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setIsEditing(false);
        router.refresh();
      } else {
        const error = await response.json();
        alert(error.error || "Bir hata oluştu");
      }
    } catch (error) {
      console.error("Proje ayarları güncellenemedi:", error);
      alert("Bir hata oluştu");
    }
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-3 flex-1">
            <div>
              <label className="block text-sm font-medium mb-1">Proje Adı</label>
              <p className="text-gray-400">{project.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Framework</label>
              <p className="text-gray-400">{project.framework}</p>
            </div>
          </div>
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Düzenle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Proje Adı</label>
        <Input
          {...register("name")}
          className="bg-black border-gray-700"
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Build Command</label>
        <Input
          {...register("buildCommand")}
          placeholder="npm run build"
          className="bg-black border-gray-700"
        />
        <p className="text-gray-400 text-xs mt-1">
          Projenizi build etmek için kullanılacak komut
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Output Directory</label>
        <Input
          {...register("outputDirectory")}
          placeholder="Otomatik algılanır"
          className="bg-black border-gray-700"
        />
        <p className="text-gray-400 text-xs mt-1">
          Build çıktısının bulunduğu dizin
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Install Command</label>
        <Input
          {...register("installCommand")}
          placeholder="npm install"
          className="bg-black border-gray-700"
        />
        <p className="text-gray-400 text-xs mt-1">
          Bağımlılıkları yüklemek için kullanılacak komut
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Root Directory</label>
        <Input
          {...register("rootDirectory")}
          placeholder="./"
          className="bg-black border-gray-700"
        />
        <p className="text-gray-400 text-xs mt-1">
          Projenizin kök dizini
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Node.js Version</label>
        <Input
          {...register("nodeVersion")}
          placeholder="18.x"
          className="bg-black border-gray-700"
        />
        <p className="text-gray-400 text-xs mt-1">
          Kullanılacak Node.js versiyonu
        </p>
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          className="border-gray-700 hover:bg-gray-800"
        >
          İptal
        </Button>
      </div>
    </form>
  );
} 