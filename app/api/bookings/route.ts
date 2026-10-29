import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 8. POST /api/bookings => เพิ่มการจอง
// ต้องส่ง roomId, bookerName, purpose, startTime, endTime, attendeeCount
// ตรวจว่าห้องมีจริง เวลาเริ่มเป็นอนาคต เวลาเริ่มน้อยกว่าเวลาสิ้นสุด จำนวนคนไม่เกินความจุ และไม่มีเวลาจองทับซ้อน
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, bookerName, purpose, startTime, endTime, attendeeCount } = body;

    // Validate presence and types
    if (roomId === undefined || roomId === null) {
      return NextResponse.json({ error: "ต้องระบุ roomId" }, { status: 400 });
    }
    const parsedRoomId = Number(roomId);
    if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
      return NextResponse.json({ error: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" }, { status: 400 });
    }

    if (
      typeof bookerName !== "string" ||
      bookerName.trim() === "" ||
      typeof purpose !== "string" ||
      purpose.trim() === ""
    ) {
      return NextResponse.json(
        { error: "bookerName และ purpose ต้องเป็นข้อความและห้ามว่าง" },
        { status: 400 }
      );
    }

    if (attendeeCount === undefined || attendeeCount === null) {
      return NextResponse.json({ error: "ต้องระบุ attendeeCount" }, { status: 400 });
    }
    const parsedAttendeeCount = Number(attendeeCount);
    if (!Number.isInteger(parsedAttendeeCount) || parsedAttendeeCount <= 0) {
      return NextResponse.json(
        { error: "attendeeCount ต้องเป็นจำนวนเต็มมากกว่า 0" },
        { status: 400 }
      );
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "ต้องระบุ startTime และ endTime" },
        { status: 400 }
      );
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "รูปแบบวันเวลาของ startTime หรือ endTime ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const now = new Date();

    // เงื่อนไข: เวลาเริ่มเป็นอนาคต
    if (startDate <= now) {
      return NextResponse.json(
        { error: "เวลาเริ่มใช้งาน (startTime) ต้องเป็นเวลาในอนาคต" },
        { status: 400 }
      );
    }

    // เงื่อนไข: เวลาเริ่มน้อยกว่าเวลาสิ้นสุด
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "เวลาเริ่มใช้งาน (startTime) ต้องน้อยกว่าเวลาสิ้นสุด (endTime)" },
        { status: 400 }
      );
    }

    // ตรวจว่าห้องมีจริง
    const room = await prisma.room.findUnique({
      where: { id: parsedRoomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: "ไม่พบห้องประชุมที่ระบุ (Room not found)" },
        { status: 404 }
      );
    }

    // เงื่อนไข: จำนวนคนไม่เกินความจุ
    if (parsedAttendeeCount > room.capacity) {
      return NextResponse.json(
        {
          error: `จำนวนผู้เข้าร่วม (${parsedAttendeeCount} คน) เกินความจุของห้อง (ห้องนี้รองรับได้ ${room.capacity} คน)`,
        },
        { status: 400 }
      );
    }

    // เงื่อนไข: ไม่มีเวลาจองทับซ้อน
    // ช่วงเวลาทับซ้อนเมื่อ: booking.startTime < endDate && booking.endTime > startDate
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: parsedRoomId,
        startTime: { lt: endDate },
        endTime: { gt: startDate },
      },
    });

    if (conflict) {
      return NextResponse.json(
        {
          error: "ช่วงเวลาที่ต้องการจองทับซ้อนกับรายการจองที่มีอยู่แล้วในห้องนี้",
        },
        { status: 409 }
      );
    }

    const newBooking = await prisma.booking.create({
      data: {
        roomId: parsedRoomId,
        bookerName: bookerName.trim(),
        purpose: purpose.trim(),
        startTime: startDate,
        endTime: endDate,
        attendeeCount: parsedAttendeeCount,
      },
      include: {
        room: true,
      },
    });

    return NextResponse.json(newBooking, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 9. GET /api/bookings => แสดงรายการจองพร้อมข้อมูลห้อง
// รองรับการค้นหา กรอง และแบ่งหน้าตามรายละเอียดด้านล่าง
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const roomId = searchParams.get("roomId");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const where: any = {};

    if (search && search.trim() !== "") {
      const keyword = search.trim();
      where.OR = [
        { bookerName: { contains: keyword } },
        { purpose: { contains: keyword } },
        { room: { roomName: { contains: keyword } } },
        { room: { roomCode: { contains: keyword } } },
      ];
    }

    if (roomId !== null && roomId !== "") {
      const parsedRoomId = Number(roomId);
      if (!isNaN(parsedRoomId)) {
        where.roomId = parsedRoomId;
      }
    }

    const total = await prisma.booking.count({ where });

    const isPaginated = pageParam !== null || limitParam !== null;
    const page = pageParam ? Math.max(1, parseInt(pageParam)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam)) : 10;

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: true,
      },
      orderBy: {
        startTime: "asc",
      },
      ...(isPaginated ? { skip: (page - 1) * limit, take: limit } : {}),
    });

    if (isPaginated) {
      return NextResponse.json(
        {
          data: bookings,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(bookings, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
