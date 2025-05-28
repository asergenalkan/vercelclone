import bcrypt from "bcrypt";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email ve şifre gereklidir");
        }

        const user = await db.user.findUnique({
          where: {
            email: credentials.email,
          },
        });

        if (!user || !user.password) {
          throw new Error("Kullanıcı bulunamadı");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Geçersiz şifre");
        }

        return user;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // GitHub OAuth ile giriş yapılıyorsa
      if (account?.provider === "github") {
        try {
          // Aynı email'e sahip kullanıcı var mı kontrol et
          const existingUser = await db.user.findUnique({
            where: { email: user.email! },
            include: { accounts: true }
          });

          if (existingUser) {
            // GitHub account zaten bağlı mı kontrol et
            const githubAccount = existingUser.accounts.find(
              acc => acc.provider === "github"
            );

            if (!githubAccount) {
              // GitHub account'ı mevcut kullanıcıya bağla
              await db.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                }
              });
            }
          }
        } catch (error) {
          console.error("Account linking hatası:", error);
          return false;
        }
      }
      return true;
    },
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name ?? null;
        session.user.email = token.email ?? "";
        session.user.image = token.picture ?? null;
        
        // GitHub access token'ını session'a ekle
        if (token.githubAccessToken) {
          (session as any).githubAccessToken = token.githubAccessToken;
        }
      }

      return session;
    },
    async jwt({ token, user, account }) {
      // İlk giriş
      if (user) {
        token.id = user.id;
      }

      // GitHub OAuth ile giriş yapıldıysa, access token'ı sakla
      if (account?.provider === "github") {
        token.githubAccessToken = account.access_token;
      }

      const existingUser = await db.user.findFirst({
        where: {
          email: token.email as string,
        },
      });

      if (!existingUser) {
        return token;
      }

      return {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        picture: existingUser.image,
        githubAccessToken: token.githubAccessToken,
      };
    },
  },
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
} 