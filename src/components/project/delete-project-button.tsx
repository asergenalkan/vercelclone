"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/dashboard");
      } else {
        const error = await response.json();
        alert(error.error || "Proje silinirken bir hata oluştu");
        setShowConfirm(false);
      }
    } catch (error) {
      console.error("Proje silinemedi:", error);
      alert("Bir hata oluştu");
      setShowConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (showConfirm) {
    return (
      <div className="space-y-4">
        <div className="bg-red-950/50 border border-red-800 rounded-lg p-4">
          <p className="text-sm mb-2">
            <strong>"{projectName}"</strong> projesini silmek istediğinize emin misiniz?
          </p>
          <p className="text-xs text-gray-400">
            Bu işlem geri alınamaz. Tüm deploymentlar, domainler, environment variables ve ayarlar kalıcı olarak silinecektir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? "Siliniyor..." : "Evet, Sil"}
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="border-gray-700 hover:bg-gray-800"
          >
            İptal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleDelete}
      variant="outline"
      className="border-red-700 text-red-500 hover:bg-red-950"
    >
      Projeyi Sil
    </Button>
  );
} 