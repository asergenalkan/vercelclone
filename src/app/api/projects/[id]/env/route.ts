import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { encrypt, decrypt } from "@/lib/encryption";

// Şifreleme için basit bir yöntem (production'da daha güvenli bir yöntem kullanılmalı)
const ENCRYPTION_KEY = process.env.ENV_ENCRYPTION_KEY || "default-encryption-key-change-this";

const envVariableSchema = z.object({
  key: z.string().min(1).regex(/^[A-Z_][A-Z0-9_]*$/, {
    message: "Key must be uppercase letters, numbers, and underscores only",
  }),
  value: z.string(),
  target: z.array(z.enum(["development", "preview", "production"])).min(1),
});

// GET - Environment variables listesi
export async function GET(
  req: any,
  context: any
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const projectId = (await context.params).id;

    // Projeyi kontrol et
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı" },
        { status: 404 }
      );
    }

    // Environment variables'ları getir
    const envVariables = await db.envVariable.findMany({
      where: {
        projectId,
      },
      orderBy: {
        key: "asc",
      },
    });

    // Değerleri decrypt et
    const decryptedVariables = envVariables.map((env) => ({
      ...env,
      value: decrypt(env.value),
    }));

    return NextResponse.json({ envVariables: decryptedVariables });
  } catch (error) {
    console.error("[ENV_VARIABLES_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Environment variables alınırken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// POST - Yeni environment variable ekle
export async function POST(
  req: any,
  context: any
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const projectId = (await context.params).id;
    const body = await req.json();
    const { key, value, target } = envVariableSchema.parse(body);

    // Projeyi kontrol et
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı" },
        { status: 404 }
      );
    }

    // Aynı key var mı kontrol et
    const existing = await db.envVariable.findUnique({
      where: {
        projectId_key: {
          projectId,
          key,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Bu key zaten mevcut" },
        { status: 400 }
      );
    }

    // Değeri encrypt et ve kaydet
    const encryptedValue = encrypt(value);
    const envVariable = await db.envVariable.create({
      data: {
        projectId,
        key,
        value: encryptedValue,
        target,
      },
    });

    // Activity log ekle
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "env_added",
        metadata: {
          key,
          target,
        },
      },
    });

    return NextResponse.json({
      envVariable: {
        ...envVariable,
        value: value, // Decrypt edilmiş değeri döndür
      },
      message: "Environment variable başarıyla eklendi",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }

    console.error("[ENV_VARIABLE_CREATE_ERROR]", error);
    return NextResponse.json(
      { error: "Environment variable eklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// PATCH - Environment variable güncelle
export async function PATCH(
  req: any,
  context: any
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const projectId = (await context.params).id;
    const body = await req.json();
    const { id, key, value, target } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Environment variable ID gerekli" },
        { status: 400 }
      );
    }

    // Projeyi kontrol et
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı" },
        { status: 404 }
      );
    }

    // Env variable'ın var olduğunu ve bu projeye ait olduğunu kontrol et
    const envVariable = await db.envVariable.findFirst({
      where: {
        id,
        projectId,
      },
    });

    if (!envVariable) {
      return NextResponse.json(
        { error: "Environment variable bulunamadı" },
        { status: 404 }
      );
    }

    // Eğer key değişiyorsa, yeni key'in benzersiz olduğunu kontrol et
    if (key && key !== envVariable.key) {
      const existing = await db.envVariable.findUnique({
        where: {
          projectId_key: {
            projectId,
            key,
          },
        },
      });

      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "Bu key zaten mevcut" },
          { status: 400 }
        );
      }
    }

    // Güncelleme verilerini hazırla
    const updateData: any = {};
    
    if (key) {
      updateData.key = key;
    }
    
    if (value) {
      updateData.value = encrypt(value);
    }
    
    if (target) {
      updateData.target = target;
    }

    // Env variable'ı güncelle
    const updatedEnvVariable = await db.envVariable.update({
      where: {
        id,
      },
      data: updateData,
    });

    // Activity log ekle
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "env_updated",
        metadata: {
          key: updatedEnvVariable.key,
        },
      },
    });

    return NextResponse.json({
      envVariable: {
        ...updatedEnvVariable,
        value: value || decrypt(updatedEnvVariable.value), // Decrypt edilmiş değeri döndür
      },
      message: "Environment variable başarıyla güncellendi",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }

    console.error("[ENV_VARIABLE_UPDATE_ERROR]", error);
    return NextResponse.json(
      { error: "Environment variable güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

// DELETE - Environment variable sil
export async function DELETE(
  req: any,
  context: any
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const projectId = (await context.params).id;
    const searchParams = new URL(req.url).searchParams;
    const envId = searchParams.get("envId");

    if (!envId) {
      return NextResponse.json(
        { error: "Environment variable ID gerekli" },
        { status: 400 }
      );
    }

    // Projeyi kontrol et
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı" },
        { status: 404 }
      );
    }

    // Env variable'ın var olduğunu ve bu projeye ait olduğunu kontrol et
    const envVariable = await db.envVariable.findFirst({
      where: {
        id: envId,
        projectId,
      },
    });

    if (!envVariable) {
      return NextResponse.json(
        { error: "Environment variable bulunamadı" },
        { status: 404 }
      );
    }

    // Env variable'ı sil
    await db.envVariable.delete({
      where: {
        id: envId,
      },
    });

    // Activity log ekle
    await db.activity.create({
      data: {
        userId: session.user.id,
        projectId,
        type: "env_deleted",
        metadata: {
          key: envVariable.key,
        },
      },
    });

    return NextResponse.json({
      message: "Environment variable başarıyla silindi",
    });
  } catch (error) {
    console.error("[ENV_VARIABLE_DELETE_ERROR]", error);
    return NextResponse.json(
      { error: "Environment variable silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
} 