import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 13. GET /api/bookings/upcoming => แสดงการจองที่เวลาเริ่มอยู่ตั้งแต่ปัจจุบันถึงอีก days วัน
// ค่าเริ่มต้น 7 รับจำนวนเต็ม 1–30 กรองด้วย roomId ได้ และเรียงรายการที่เริ่มก่อนขึ้นก่อน
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const roomIdParam = searchParams.get("roomId");

    let days = 7;
    if (daysParam !== null && daysParam !== "") {
      const parsedDays = Number(daysParam);
      if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 30) {
        return NextResponse.json(
          { error: "days ต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 30" },
          { status: 400 }
        );
      }
      days = parsedDays;
    }

    const now = new Date();
    const untilDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const where: any = {
      startTime: {
        gte: now,
        lte: untilDate,
      },
    };

    if (roomIdParam !== null && roomIdParam !== "") {
      const parsedRoomId = Number(roomIdParam);
      if (!Number.isInteger(parsedRoomId) || parsedRoomId <= 0) {
        return NextResponse.json(
          { error: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" },
          { status: 400 }
        );
      }
      where.roomId = parsedRoomId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        room: true,
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return NextResponse.json(bookings, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
