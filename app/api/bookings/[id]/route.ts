import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

// 10. GET /api/bookings/[id] => แสดงรายละเอียดการจองหนึ่งรายการพร้อมข้อมูลห้อง หากไม่พบให้ตอบ 404
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const id = Number(rawId);

    if (isNaN(id) || !Number.isInteger(id)) {
      return NextResponse.json({ error: "รหัสรายการจอง (ID) ไม่ถูกต้อง" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรายการจอง (Booking not found)" }, { status: 404 });
    }

    return NextResponse.json(booking, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 11. PATCH /api/bookings/[id] => แก้ไขบางฟิลด์ รวมถึงย้ายห้องหรือเปลี่ยนเวลา
// อนุญาตเฉพาะรายการที่ยังไม่เริ่มใช้งาน
// ต้องตรวจข้อมูลหลังรวมค่าใหม่กับค่าเดิม และตรวจเวลาทับซ้อนโดยยกเว้นรายการตัวเอง
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const id = Number(rawId);

    if (isNaN(id) || !Number.isInteger(id)) {
      return NextResponse.json({ error: "รหัสรายการจอง (ID) ไม่ถูกต้อง" }, { status: 400 });
    }

    const existingBooking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!existingBooking) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรายการจอง (Booking not found)" }, { status: 404 });
    }

    const now = new Date();

    // อนุญาตเฉพาะรายการที่ยังไม่เริ่มใช้งาน
    if (existingBooking.startTime <= now) {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้แก้ไขรายการจองที่เริ่มใช้งานไปแล้ว" },
        { status: 409 }
      );
    }

    const body = await request.json();
    const { roomId, bookerName, purpose, startTime, endTime, attendeeCount } = body;

    // ตรวจข้อมูลหลังรวมค่าใหม่กับค่าเดิม
    const mergedRoomId =
      roomId !== undefined ? Number(roomId) : existingBooking.roomId;
    const mergedBookerName =
      bookerName !== undefined ? String(bookerName).trim() : existingBooking.bookerName;
    const mergedPurpose =
      purpose !== undefined ? String(purpose).trim() : existingBooking.purpose;
    const mergedStartTime =
      startTime !== undefined ? new Date(startTime) : existingBooking.startTime;
    const mergedEndTime =
      endTime !== undefined ? new Date(endTime) : existingBooking.endTime;
    const mergedAttendeeCount =
      attendeeCount !== undefined ? Number(attendeeCount) : existingBooking.attendeeCount;

    // Validate merged values
    if (!Number.isInteger(mergedRoomId) || mergedRoomId <= 0) {
      return NextResponse.json({ error: "roomId ต้องเป็นจำนวนเต็มมากกว่า 0" }, { status: 400 });
    }

    if (mergedBookerName === "") {
      return NextResponse.json({ error: "bookerName ต้องไม่เป็นค่าว่าง" }, { status: 400 });
    }

    if (mergedPurpose === "") {
      return NextResponse.json({ error: "purpose ต้องไม่เป็นค่าว่าง" }, { status: 400 });
    }

    if (!Number.isInteger(mergedAttendeeCount) || mergedAttendeeCount <= 0) {
      return NextResponse.json({ error: "attendeeCount ต้องเป็นจำนวนเต็มมากกว่า 0" }, { status: 400 });
    }

    if (isNaN(mergedStartTime.getTime()) || isNaN(mergedEndTime.getTime())) {
      return NextResponse.json({ error: "รูปแบบวันเวลาไม่ถูกต้อง" }, { status: 400 });
    }

    if (mergedStartTime <= now) {
      return NextResponse.json(
        { error: "เวลาเริ่มใช้งาน (startTime) ต้องเป็นเวลาในอนาคต" },
        { status: 400 }
      );
    }

    if (mergedStartTime >= mergedEndTime) {
      return NextResponse.json(
        { error: "เวลาเริ่มใช้งาน (startTime) ต้องน้อยกว่าเวลาสิ้นสุด (endTime)" },
        { status: 400 }
      );
    }

    // ตรวจสอบห้องเป้าหมาย
    const targetRoom = await prisma.room.findUnique({
      where: { id: mergedRoomId },
    });

    if (!targetRoom) {
      return NextResponse.json({ error: "ไม่พบห้องประชุมที่ระบุ (Room not found)" }, { status: 404 });
    }

    // ตรวจสอบความจุ
    if (mergedAttendeeCount > targetRoom.capacity) {
      return NextResponse.json(
        {
          error: `จำนวนผู้เข้าร่วม (${mergedAttendeeCount} คน) เกินความจุของห้อง (ห้องนี้รองรับได้ ${targetRoom.capacity} คน)`,
        },
        { status: 400 }
      );
    }

    // ตรวจเวลาทับซ้อนโดยยกเว้นรายการตัวเอง (id != currentId)
    const conflict = await prisma.booking.findFirst({
      where: {
        id: { not: id },
        roomId: mergedRoomId,
        startTime: { lt: mergedEndTime },
        endTime: { gt: mergedStartTime },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: "ช่วงเวลาที่ต้องการแก้ไขทับซ้อนกับรายการจองอื่นในห้องนี้" },
        { status: 409 }
      );
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        roomId: mergedRoomId,
        bookerName: mergedBookerName,
        purpose: mergedPurpose,
        startTime: mergedStartTime,
        endTime: mergedEndTime,
        attendeeCount: mergedAttendeeCount,
      },
      include: {
        room: true,
      },
    });

    return NextResponse.json(updatedBooking, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// 12. DELETE /api/bookings/[id] => ยกเลิกโดยลบรายการจอง
// อนุญาตเฉพาะรายการที่ยังไม่เริ่มใช้งาน หากเริ่มแล้วให้ตอบ 409
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const id = Number(rawId);

    if (isNaN(id) || !Number.isInteger(id)) {
      return NextResponse.json({ error: "รหัสรายการจอง (ID) ไม่ถูกต้อง" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรายการจอง (Booking not found)" }, { status: 404 });
    }

    const now = new Date();

    // อนุญาตเฉพาะรายการที่ยังไม่เริ่มใช้งาน หากเริ่มแล้วให้ตอบ 409
    if (booking.startTime <= now) {
      return NextResponse.json(
        { error: "ไม่อนุญาตให้ยกเลิกรายการจองที่เริ่มใช้งานไปแล้ว" },
        { status: 409 }
      );
    }

    await prisma.booking.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "ยกเลิกรายการจองสำเร็จ", id },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
