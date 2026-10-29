import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 15. DELETE /api/bookings/expired => ลบประวัติการจองหลายรายการ
// ต้องส่ง roomId และ before
// ลบเฉพาะรายการในห้องนั้นที่ endTime น้อยกว่า before โดย before ต้องไม่เกินเวลาปัจจุบัน
// คืนจำนวนรายการที่ลบ
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let roomId = searchParams.get("roomId");
    let before = searchParams.get("before");

    // If not found in query params, check body if present
    if (!roomId || !before) {
      try {
        const body = await request.json();
        if (body) {
          if (!roomId && body.roomId !== undefined) roomId = String(body.roomId);
          if (!before && body.before !== undefined) before = String(body.before);
        }
      } catch {
        // Body was empty or not json, ignore
      }
    }

    if (!roomId || !before) {
      return NextResponse.json(
        { error: "ต้องส่ง roomId และ before (สามารถส่งทาง query params หรือ request body ได้)" },
        { status: 400 }
      );
    }

    const parsedRoomId = Number(roomId);
    if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
      return NextResponse.json(
        { error: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" },
        { status: 400 }
      );
    }

    const beforeDate = new Date(before);
    if (isNaN(beforeDate.getTime())) {
      return NextResponse.json(
        { error: "รูปแบบวันเวลาของ before ไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const now = new Date();
    // โดย before ต้องไม่เกินเวลาปัจจุบัน
    if (beforeDate > now) {
      return NextResponse.json(
        { error: "before ต้องไม่เกินเวลาปัจจุบัน" },
        { status: 400 }
      );
    }

    // ตรวจสอบว่าห้องมีอยู่จริง
    const room = await prisma.room.findUnique({
      where: { id: parsedRoomId },
    });

    if (!room) {
      return NextResponse.json(
        { error: "ไม่พบห้องประชุมที่ระบุ (Room not found)" },
        { status: 404 }
      );
    }

    // ลบเฉพาะรายการในห้องนั้นที่ endTime น้อยกว่า before
    const deleteResult = await prisma.booking.deleteMany({
      where: {
        roomId: parsedRoomId,
        endTime: {
          lt: beforeDate,
        },
      },
    });

    return NextResponse.json(
      {
        message: `ลบรายการจองที่หมดอายุสำเร็จ`,
        roomId: parsedRoomId,
        before: beforeDate.toISOString(),
        deletedCount: deleteResult.count,
        count: deleteResult.count,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
