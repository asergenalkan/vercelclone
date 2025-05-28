import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return new Response("Socket.io endpoint", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

export async function POST(req: NextRequest) {
  return new Response("Socket.io endpoint", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
} 