import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const domainSchema = z.object({
  name: z.string().min(3, { message: "Domain adı en az 3 karakter olmalıdır" }),
});

export async function POST(
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
    const { name } = domainSchema.parse(body);

    // Projenin var olduğunu ve kullanıcıya ait olduğunu kontrol et
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Domain'in daha önce eklenip eklenmediğini kontrol et
    const existingDomain = await db.domain.findUnique({
      where: {
        name,
      },
    });

    if (existingDomain) {
      return NextResponse.json(
        { error: "Bu domain zaten kullanımda" },
        { status: 409 }
      );
    }

    // Domain oluştur
    const domain = await db.domain.create({
      data: {
        name,
        projectId,
        verified: false,
      },
    });

    return NextResponse.json(
      { domain, message: "Domain başarıyla eklendi, doğrulama bekliyor" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }

    console.error("[DOMAİN_EKLEME_HATASI]", error);
    return NextResponse.json(
      { error: "Domain eklenirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function GET(
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
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId: session.user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Domainleri getir
    const domains = await db.domain.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ domains });
  } catch (error) {
    console.error("[DOMAİN_LİSTELEME_HATASI]", error);
    return NextResponse.json(
      { error: "Domainler listelenirken bir hata oluştu" },
      { status: 500 }
    );
  }
} 