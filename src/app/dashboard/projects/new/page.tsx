"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const projectSchema = z.object({
  name: z.string().min(2, { message: "Proje adı en az 2 karakter olmalıdır" }),
  description: z.string().optional(),
  framework: z.string().default("next"),
  repoUrl: z.string().url({ message: "Geçerli bir URL giriniz" }).optional().or(z.literal("")),
  gitProvider: z.string().default("github"),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function NewProjectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      framework: "next",
      repoUrl: "",
      gitProvider: "github",
    },
  });

  const onSubmit = async (data: ProjectFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Proje oluşturulurken bir hata oluştu");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Proje oluşturma hatası:", error);
      setError(error instanceof Error ? error.message : "Proje oluşturulurken bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xl font-bold">
              Vercel Klonu
            </Link>
            <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">Yeni Proje</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Yeni Proje Oluştur</h2>
          <p className="text-gray-400">
            Projelerinizi kolayca oluşturun ve deployment işlemlerini başlatın.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-500/20 border border-red-500 text-red-300 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium">
              Proje Adı <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              placeholder="Örn: my-awesome-project"
              {...register("name")}
              className="bg-gray-800 border-gray-700"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium">
              Açıklama
            </label>
            <Input
              id="description"
              placeholder="Projenizin kısa bir açıklaması"
              {...register("description")}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="framework" className="block text-sm font-medium">
              Framework
            </label>
            <select
              id="framework"
              {...register("framework")}
              className="w-full h-10 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            >
              <option value="next">Next.js</option>
              <option value="react">React</option>
              <option value="vue">Vue</option>
              <option value="nuxt">Nuxt</option>
              <option value="svelte">Svelte</option>
              <option value="astro">Astro</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="repoUrl" className="block text-sm font-medium">
              Git Repository URL (opsiyonel)
            </label>
            <Input
              id="repoUrl"
              placeholder="https://github.com/username/repo"
              {...register("repoUrl")}
              className="bg-gray-800 border-gray-700"
            />
            {errors.repoUrl && (
              <p className="text-sm text-red-500">{errors.repoUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="gitProvider" className="block text-sm font-medium">
              Git Provider
            </label>
            <select
              id="gitProvider"
              {...register("gitProvider")}
              className="w-full h-10 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
            >
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="bitbucket">Bitbucket</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? "Oluşturuluyor..." : "Proje Oluştur"}
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
                İptal
              </Button>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
} 