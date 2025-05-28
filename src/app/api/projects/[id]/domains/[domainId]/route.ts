import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; domainId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const { id: projectId, domainId } = params;

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

    // Domain'in var olduğunu ve projeye ait olduğunu kontrol et
    const domain = await db.domain.findFirst({
      where: {
        id: domainId,
        projectId,
      },
    });

    if (!domain) {
      return NextResponse.json(
        { error: "Domain bulunamadı veya bu projeye ait değil" },
        { status: 404 }
      );
    }

    // Domain'i sil
    await db.domain.delete({
      where: {
        id: domainId,
      },
    });

    return NextResponse.json({
      message: "Domain başarıyla silindi",
    });
  } catch (error) {
    console.error("[DOMAİN_SİLME_HATASI]", error);
    return NextResponse.json(
      { error: "Domain silinirken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; domainId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const { id: projectId, domainId } = params;

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

    // Domain'in var olduğunu ve projeye ait olduğunu kontrol et
    const domain = await db.domain.findFirst({
      where: {
        id: domainId,
        projectId,
      },
    });

    if (!domain) {
      return NextResponse.json(
        { error: "Domain bulunamadı veya bu projeye ait değil" },
        { status: 404 }
      );
    }

    // Gerçek bir uygulamada, burada domain doğrulama kontrolü yapılır
    // Örneğin DNS kayıtlarını kontrol etme gibi
    // Bu örnekte doğrudan doğrulanmış olarak işaretliyoruz

    // Domain'i doğrulanmış olarak güncelle
    const updatedDomain = await db.domain.update({
      where: {
        id: domainId,
      },
      data: {
        verified: true,
      },
    });

    return NextResponse.json({
      domain: updatedDomain,
      message: "Domain başarıyla doğrulandı",
    });
  } catch (error) {
    console.error("[DOMAİN_DOĞRULAMA_HATASI]", error);
    return NextResponse.json(
      { error: "Domain doğrulanırken bir hata oluştu" },
      { status: 500 }
    );
  }
} 