"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const domainSchema = z.object({
  name: z.string().min(3, { message: "Domain adı en az 3 karakter olmalıdır" }),
});

type DomainFormValues = z.infer<typeof domainSchema>;

export default function NewDomainPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DomainFormValues>({
    resolver: zodResolver(domainSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (data: DomainFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/domains`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Domain eklenirken bir hata oluştu");
      }

      router.push(`/dashboard/projects/${projectId}`);
      router.refresh();
    } catch (error) {
      console.error("Domain ekleme hatası:", error);
      setError(error instanceof Error ? error.message : "Domain eklenirken bir hata oluştu");
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
            <span className="text-gray-400">/</span>
            <Link href={`/dashboard/projects/${projectId}`} className="text-blue-500">
              Proje
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-blue-500">Yeni Domain</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Domain Ekle</h2>
          <p className="text-gray-400">
            Projenize özel bir domain ekleyin. Domain doğrulaması gerekecektir.
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
              Domain Adı <span className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              placeholder="örn: example.com"
              {...register("name")}
              className="bg-gray-800 border-gray-700"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm">
            <h3 className="font-medium mb-2">Domain Doğrulama</h3>
            <p className="text-gray-400 mb-4">
              Domaininiizi doğrulamak için aşağıdaki DNS ayarlarını yapmanız gerekecek:
            </p>
            <div className="space-y-2">
              <div className="p-2 bg-gray-800 rounded border border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tip:</span>
                  <span>A</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-400">İsim:</span>
                  <span>@</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-400">Değer:</span>
                  <span>76.76.21.21</span>
                </div>
              </div>
              <div className="p-2 bg-gray-800 rounded border border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tip:</span>
                  <span>CNAME</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-400">İsim:</span>
                  <span>www</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-400">Değer:</span>
                  <span>cname.vercel-clone.app</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? "Ekleniyor..." : "Domain Ekle"}
            </Button>
            <Link href={`/dashboard/projects/${projectId}`}>
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