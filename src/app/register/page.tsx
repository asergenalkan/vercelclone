"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const registerSchema = z.object({
  name: z.string().min(2, { message: "İsim en az 2 karakter olmalıdır" }),
  email: z.string().email({ message: "Geçerli bir e-posta adresi giriniz" }),
  password: z.string().min(8, { message: "Şifre en az 8 karakter olmalıdır" }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Kayıt sırasında bir hata oluştu");
      }

      // Başarıyla kaydolduktan sonra giriş sayfasına yönlendir
      router.push("/login?success=Kaydınız başarıyla oluşturuldu. Giriş yapabilirsiniz.");
    } catch (error) {
      console.error("Kayıt hatası:", error);
      setError(error instanceof Error ? error.message : "Kayıt sırasında bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-black text-white">
      <div className="w-full max-w-md space-y-8 p-8 rounded-lg border border-gray-800 bg-gray-900">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Kayıt Ol</h1>
          <p className="mt-2 text-gray-400">Hesabınızı oluşturun ve platformumuzu kullanmaya başlayın</p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-500/20 border border-red-500 text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium">
              İsim
            </label>
            <Input
              id="name"
              placeholder="Adınız Soyadınız"
              {...register("name")}
              className="bg-gray-800 border-gray-700"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              E-posta
            </label>
            <Input
              id="email"
              type="email"
              placeholder="ornek@email.com"
              {...register("email")}
              className="bg-gray-800 border-gray-700"
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              Şifre
            </label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              {...register("password")}
              className="bg-gray-800 border-gray-700"
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? "Kaydediliyor..." : "Kayıt Ol"}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <p className="text-gray-400">
            Zaten hesabınız var mı?{" "}
            <Link href="/login" className="text-blue-500 hover:underline">
              Giriş yapın
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 