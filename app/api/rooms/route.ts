import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1. POST /api/rooms => เพิ่มห้อง
// ต้องส่ง roomCode, roomName, capacity, location โดยข้อความห้ามว่าง รหัสห้องห้ามซ้ำ และความจุต้องเป็นจำนวนเต็มมากกว่า 0
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomCode, roomName, capacity, location } = body;

    // Validate presence and non-empty string
    if (
      typeof roomCode !== "string" ||
      roomCode.trim() === "" ||
      typeof roomName !== "string" ||
      roomName.trim() === "" ||
      typeof location !== "string" ||
      location.trim() === ""
    ) {
      return NextResponse.json(
        { error: "roomCode, roomName และ location ต้องเป็นข้อความและห้ามว่าง" },
        { status: 400 }
      );
    }

    // Validate capacity: integer > 0
    const parsedCapacity = Number(capacity);
    if (
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity <= 0
    ) {
      return NextResponse.json(
        { error: "capacity ต้องเป็นจำนวนเต็มมากกว่า 0" },
        { status: 400 }
      );
    }

    const trimmedCode = roomCode.trim();
    const trimmedName = roomName.trim();
    const trimmedLocation = location.trim();

    // Check if roomCode already exists
    const existing = await prisma.room.findUnique({
      where: { roomCode: trimmedCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "รหัสห้องนี้มีอยู่แล้วในระบบ (roomCode already exists)" },
        { status: 409 }
      );
    }

    const newRoom = await prisma.room.create({
      data: {
        roomCode: trimmedCode,
        roomName: trimmedName,
        capacity: parsedCapacity,
        location: trimmedLocation,
      },
    });

    return NextResponse.json(newRoom, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 2. GET /api/rooms => แสดงรายการห้อง
// รองรับ search เพื่อค้นหาในชื่อห้อง หรือ สถานที่ และ minCapacity เพื่อกรองความจุขั้นต่ำ หากไม่ส่งตัวกรองให้แสดงทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const minCapacity = searchParams.get("minCapacity");

    const where: any = {};

    if (search && search.trim() !== "") {
      const keyword = search.trim();
      where.OR = [
        { roomName: { contains: keyword } },
        { location: { contains: keyword } },
      ];
    }

    if (minCapacity !== null && minCapacity !== "") {
      const parsedMin = Number(minCapacity);
      if (!isNaN(parsedMin)) {
        where.capacity = { gte: parsedMin };
      }
    }

    const rooms = await prisma.room.findMany({
      where,
      orderBy: { id: "asc" },
    });

    return NextResponse.json(rooms, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
