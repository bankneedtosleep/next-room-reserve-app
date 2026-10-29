import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

// 6. GET /api/rooms/[id]/bookings => แสดงรายการจองของห้องนั้น
// รองรับ from และ to เพื่อค้นหารายการที่มีเวลาใช้งานทับซ้อนกับช่วงที่ระบุ
// ต้องส่งทั้งคู่หรือไม่ส่งเลย เรียงตามเวลาเริ่มจากน้อยไปมาก
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const id = Number(rawId);

    if (isNaN(id) || !Number.isInteger(id)) {
      return NextResponse.json({ error: "รหัสห้อง (ID) ไม่ถูกต้อง" }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return NextResponse.json({ error: "ไม่พบข้อมูลห้องประชุม (Room not found)" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // ต้องส่งทั้งคู่หรือไม่ส่งเลย
    if ((from && !to) || (!from && to)) {
      return NextResponse.json(
        { error: "ต้องระบุพารามิเตอร์ from และ to ทั้งคู่ หรือไม่ระบุเลย" },
        { status: 400 }
      );
    }

    const where: any = {
      roomId: id,
    };

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: "รูปแบบวันเวลาของ from หรือ to ไม่ถูกต้อง" },
          { status: 400 }
        );
      }

      if (fromDate >= toDate) {
        return NextResponse.json(
          { error: "ค่า from ต้องน้อยกว่า to" },
          { status: 400 }
        );
      }

      // ค้นหารายการที่มีเวลาใช้งานทับซ้อนกับช่วงที่ระบุ:
      // startTime < to && endTime > from
      where.startTime = { lt: toDate };
      where.endTime = { gt: fromDate };
    }

    const bookings = await prisma.booking.findMany({
      where,
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
