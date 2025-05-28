import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const projectUpdateSchema = z.object({
  name: z.string().min(2, { message: "Proje adı en az 2 karakter olmalıdır" }).optional(),
  description: z.string().optional(),
  framework: z.string().optional(),
  repoUrl: z.string().url().optional().nullable(),
  gitProvider: z.string().optional(),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  installCommand: z.string().optional(),
  rootDirectory: z.string().optional(),
  nodeVersion: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId,
      },
      include: {
        deployments: {
          orderBy: {
            createdAt: "desc",
          },
        },
        domains: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("[PROJE_DETAY_HATASI]", error);
    return NextResponse.json(
      { error: "Proje detayları alınırken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const projectId = params.id;
    const body = await req.json();
    
    const validatedData = projectUpdateSchema.parse(body);

    // Projenin var olduğunu ve kullanıcıya ait olduğunu kontrol et
    const existingProject = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: "Proje bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Projeyi güncelle
    const updatedProject = await db.project.update({
      where: {
        id: projectId,
      },
      data: validatedData,
    });

    return NextResponse.json({
      project: updatedProject,
      message: "Proje başarıyla güncellendi",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }

    console.error("[PROJE_GÜNCELLEME_HATASI]", error);
    return NextResponse.json(
      { error: "Proje güncellenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const projectId = params.id;

    // Projenin var olduğunu ve kullanıcıya ait olduğunu kontrol et
    const existingProject = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: "Proje bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Projeyi ve ilişkili kayıtları sil
    await db.project.delete({
      where: {
        id: projectId,
      },
    });

    return NextResponse.json({
      message: "Proje başarıyla silindi",
    });
  } catch (error) {
    console.error("[PROJE_SİLME_HATASI]", error);
    return NextResponse.json(
      { error: "Proje silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
} 