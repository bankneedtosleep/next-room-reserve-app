// Test all 15 APIs against the specification
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function cleanupPreviousTests() {
  const codes = ["A101", "B202", "DEL1"];
  const testRooms = await prisma.room.findMany({
    where: { roomCode: { in: codes } },
  });
  const roomIds = testRooms.map((r) => r.id);
  if (roomIds.length > 0) {
    await prisma.booking.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
  }
}

async function runTests() {
  await cleanupPreviousTests();

  console.log("=== STARTING 15 APIS VERIFICATION ===");

  // 1. POST /api/rooms
  console.log("\n[API 1: POST /api/rooms]");
  // Test validation error: empty string
  let res = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "", roomName: "Test Room", capacity: 10, location: "Floor 1" }),
  });
  assert(res.status === 400, "Reject empty roomCode with 400");

  // Test validation error: capacity <= 0
  res = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "R100", roomName: "Test Room", capacity: 0, location: "Floor 1" }),
  });
  assert(res.status === 400, "Reject capacity <= 0 with 400");

  // Create valid room 1
  res = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "A101", roomName: "Innovation Room", capacity: 15, location: "Building A, Floor 1" }),
  });
  const room1 = await res.json();
  assert(res.status === 201 && room1.id && room1.roomCode === "A101", "Create Room A101 successfully with 201");

  // Duplicate roomCode check
  res = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "A101", roomName: "Duplicate Code Room", capacity: 20, location: "Floor 2" }),
  });
  assert(res.status === 409, "Reject duplicate roomCode with 409");

  // Create valid room 2
  res = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "B202", roomName: "Executive Boardroom", capacity: 30, location: "Building B, Floor 2" }),
  });
  const room2 = await res.json();
  assert(res.status === 201 && room2.id && room2.roomCode === "B202", "Create Room B202 successfully with 201");

  // 2. GET /api/rooms
  console.log("\n[API 2: GET /api/rooms]");
  res = await fetch(`${BASE_URL}/api/rooms`);
  let rooms = await res.json();
  assert(res.status === 200 && rooms.length >= 2, "Get all rooms returns list with 200");

  // Search filter
  res = await fetch(`${BASE_URL}/api/rooms?search=Executive`);
  rooms = await res.json();
  assert(res.status === 200 && rooms.some((r) => r.roomName.includes("Executive")), "Search by keyword returns matching room");

  // minCapacity filter
  res = await fetch(`${BASE_URL}/api/rooms?minCapacity=20`);
  rooms = await res.json();
  assert(res.status === 200 && rooms.every((r) => r.capacity >= 20), "minCapacity=20 returns only rooms with capacity >= 20");

  // 3. GET /api/rooms/[id]
  console.log("\n[API 3: GET /api/rooms/[id]]");
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}`);
  const fetchedRoom = await res.json();
  assert(res.status === 200 && fetchedRoom.id === room1.id, "Get room details by ID returns 200");

  res = await fetch(`${BASE_URL}/api/rooms/999999`);
  assert(res.status === 404, "Get non-existing room returns 404");

  // 4. PATCH /api/rooms/[id]
  console.log("\n[API 4: PATCH /api/rooms/[id]]");
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName: "Innovation & AI Hub" }),
  });
  const updatedRoom1 = await res.json();
  assert(res.status === 200 && updatedRoom1.roomName === "Innovation & AI Hub" && updatedRoom1.roomCode === "A101", "Update roomName while keeping other fields intact");

  // Try duplicate roomCode on PATCH
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "B202" }),
  });
  assert(res.status === 409, "Reject duplicate roomCode update with 409");

  // 8. POST /api/bookings (Create bookings to test 5, 6, 7, 8, etc.)
  console.log("\n[API 8: POST /api/bookings]");
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const start1 = new Date(tomorrow);
  start1.setHours(10, 0, 0, 0);
  const end1 = new Date(tomorrow);
  end1.setHours(12, 0, 0, 0);

  // Past time check
  const pastStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const pastEnd = new Date(Date.now() - 1 * 60 * 60 * 1000);
  res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: room1.id,
      bookerName: "Somchai",
      purpose: "Old Meeting",
      startTime: pastStart.toISOString(),
      endTime: pastEnd.toISOString(),
      attendeeCount: 5,
    }),
  });
  assert(res.status === 400, "Reject past startTime with 400");

  // Start >= End check
  res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: room1.id,
      bookerName: "Somchai",
      purpose: "Invalid Duration",
      startTime: end1.toISOString(),
      endTime: start1.toISOString(),
      attendeeCount: 5,
    }),
  });
  assert(res.status === 400, "Reject startTime >= endTime with 400");

  // Attendee count exceeds room capacity check
  res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: room1.id,
      bookerName: "Somchai",
      purpose: "Too many people",
      startTime: start1.toISOString(),
      endTime: end1.toISOString(),
      attendeeCount: 999,
    }),
  });
  assert(res.status === 400, "Reject attendeeCount > capacity with 400");

  // Valid booking creation
  res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: room1.id,
      bookerName: "Somchai Srisuk",
      purpose: "Sprint Planning Q4",
      startTime: start1.toISOString(),
      endTime: end1.toISOString(),
      attendeeCount: 10,
    }),
  });
  const booking1 = await res.json();
  assert(res.status === 201 && booking1.id, "Create valid booking 1 with 201");

  // Overlap booking check (10:30 to 11:30 in same room)
  const overlapStart = new Date(tomorrow);
  overlapStart.setHours(10, 30, 0, 0);
  const overlapEnd = new Date(tomorrow);
  overlapEnd.setHours(11, 30, 0, 0);
  res = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: room1.id,
      bookerName: "Wichai",
      purpose: "Overlapping meeting",
      startTime: overlapStart.toISOString(),
      endTime: overlapEnd.toISOString(),
      attendeeCount: 5,
    }),
  });
  assert(res.status === 409, "Reject overlapping booking with 409");

  // 4b. PATCH /api/rooms/[id] - Test cannot reduce capacity below ongoing booking attendeeCount
  console.log("\n[API 4b: Capacity restriction on PATCH /api/rooms/[id]]");
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capacity: 8 }), // booking1 has attendeeCount = 10
  });
  assert(res.status === 400, "Reject reducing capacity below attendeeCount of ongoing bookings with 400");

  // 5. DELETE /api/rooms/[id]
  console.log("\n[API 5: DELETE /api/rooms/[id]]");
  // room1 has booking1, so DELETE must return 409
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}`, { method: "DELETE" });
  assert(res.status === 409, "Cannot delete room with existing bookings, returns 409");

  // Create temporary room with no bookings, then delete it
  const tempRoomRes = await fetch(`${BASE_URL}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "DEL1", roomName: "To Delete", capacity: 5, location: "Nowhere" }),
  });
  const tempRoom = await tempRoomRes.json();
  res = await fetch(`${BASE_URL}/api/rooms/${tempRoom.id}`, { method: "DELETE" });
  assert(res.status === 200, "Delete room with no bookings succeeds with 200");

  // 6. GET /api/rooms/[id]/bookings
  console.log("\n[API 6: GET /api/rooms/[id]/bookings]");
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}/bookings`);
  let roomBookings = await res.json();
  assert(res.status === 200 && roomBookings.length >= 1, "Get bookings for room returns 200 and list");

  // Must send both from and to or neither
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}/bookings?from=${start1.toISOString()}`);
  assert(res.status === 400, "Reject when only from is provided (missing to) with 400");

  // Overlap search with from & to
  res = await fetch(`${BASE_URL}/api/rooms/${room1.id}/bookings?from=${overlapStart.toISOString()}&to=${overlapEnd.toISOString()}`);
  roomBookings = await res.json();
  assert(res.status === 200 && roomBookings.length === 1 && roomBookings[0].id === booking1.id, "Find overlapping booking with from/to interval");

  // 7. GET /api/rooms/available
  console.log("\n[API 7: GET /api/rooms/available]");
  // During start1 to end1, room1 is booked, but room2 is available
  res = await fetch(`${BASE_URL}/api/rooms/available?startTime=${start1.toISOString()}&endTime=${end1.toISOString()}`);
  let available = await res.json();
  assert(
    res.status === 200 &&
    available.some((r) => r.id === room2.id) &&
    !available.some((r) => r.id === room1.id),
    "Available rooms during booked slot returns room2 and excludes room1"
  );

  // Filter with attendeeCount
  res = await fetch(`${BASE_URL}/api/rooms/available?startTime=${start1.toISOString()}&endTime=${end1.toISOString()}&attendeeCount=25`);
  available = await res.json();
  assert(res.status === 200 && available.every((r) => r.capacity >= 25), "Available rooms filters by attendeeCount");

  // 9. GET /api/bookings
  console.log("\n[API 9: GET /api/bookings]");
  res = await fetch(`${BASE_URL}/api/bookings`);
  let allBookings = await res.json();
  assert(res.status === 200 && Array.isArray(allBookings) && allBookings[0].room !== undefined, "Get bookings includes room object");

  // Pagination test
  res = await fetch(`${BASE_URL}/api/bookings?page=1&limit=1`);
  let paginated = await res.json();
  assert(res.status === 200 && paginated.data && paginated.pagination, "Pagination returns data array and pagination metadata");

  // 10. GET /api/bookings/[id]
  console.log("\n[API 10: GET /api/bookings/[id]]");
  res = await fetch(`${BASE_URL}/api/bookings/${booking1.id}`);
  let singleBooking = await res.json();
  assert(res.status === 200 && singleBooking.id === booking1.id && singleBooking.room, "Get single booking returns 200 with room");

  res = await fetch(`${BASE_URL}/api/bookings/999999`);
  assert(res.status === 404, "Get non-existing booking returns 404");

  // 11. PATCH /api/bookings/[id]
  console.log("\n[API 11: PATCH /api/bookings/[id]]");
  // Move room1 booking to room2 and change purpose
  res = await fetch(`${BASE_URL}/api/bookings/${booking1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: room2.id, purpose: "Moved to Boardroom" }),
  });
  let updatedBooking = await res.json();
  assert(res.status === 200 && updatedBooking.roomId === room2.id && updatedBooking.purpose === "Moved to Boardroom", "Update and relocate booking to room2");

  // Move it back to room1
  await fetch(`${BASE_URL}/api/bookings/${booking1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: room1.id }),
  });

  // 13. GET /api/bookings/upcoming
  console.log("\n[API 13: GET /api/bookings/upcoming]");
  res = await fetch(`${BASE_URL}/api/bookings/upcoming?days=7`);
  let upcoming = await res.json();
  assert(res.status === 200 && Array.isArray(upcoming) && upcoming.some((b) => b.id === booking1.id), "Upcoming bookings within 7 days returns booking1");

  // Days out of bounds (0 or 31)
  res = await fetch(`${BASE_URL}/api/bookings/upcoming?days=35`);
  assert(res.status === 400, "Reject days > 30 with 400");

  // 14. GET /api/bookings/stats
  console.log("\n[API 14: GET /api/bookings/stats]");
  const statsFrom = new Date(tomorrow);
  statsFrom.setHours(0, 0, 0, 0);
  const statsTo = new Date(tomorrow);
  statsTo.setHours(23, 59, 59, 999);

  // Missing parameters
  res = await fetch(`${BASE_URL}/api/bookings/stats`);
  assert(res.status === 400, "Reject stats without from & to with 400");

  res = await fetch(`${BASE_URL}/api/bookings/stats?from=${statsFrom.toISOString()}&to=${statsTo.toISOString()}`);
  let stats = await res.json();
  assert(
    res.status === 200 &&
    stats.some((s) => s.roomId === room1.id && s.totalBookings >= 1 && s.totalHours === 2),
    "Stats returns totalBookings and 2.0 totalHours for Room 1"
  );

  // Filter stats by roomId
  res = await fetch(`${BASE_URL}/api/bookings/stats?from=${statsFrom.toISOString()}&to=${statsTo.toISOString()}&roomId=${room1.id}`);
  stats = await res.json();
  assert(res.status === 200 && stats.length === 1 && stats[0].roomId === room1.id, "Stats filtered by roomId returns only that room");

  // 12. DELETE /api/bookings/[id]
  console.log("\n[API 12: DELETE /api/bookings/[id]]");
  // Create an upcoming booking to delete
  const delStart = new Date(tomorrow);
  delStart.setHours(15, 0, 0, 0);
  const delEnd = new Date(tomorrow);
  delEnd.setHours(16, 0, 0, 0);
  const toDeleteRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: room2.id,
      bookerName: "Delete Candidate",
      purpose: "Temporary Meeting",
      startTime: delStart.toISOString(),
      endTime: delEnd.toISOString(),
      attendeeCount: 4,
    }),
  });
  const toDeleteBooking = await toDeleteRes.json();
  res = await fetch(`${BASE_URL}/api/bookings/${toDeleteBooking.id}`, { method: "DELETE" });
  assert(res.status === 200, "Cancel/Delete upcoming booking succeeds with 200");

  // 15. DELETE /api/bookings/expired
  console.log("\n[API 15: DELETE /api/bookings/expired]");
  // Test before > now rejection
  const futureBefore = new Date(Date.now() + 10 * 60 * 1000);
  res = await fetch(`${BASE_URL}/api/bookings/expired?roomId=${room1.id}&before=${futureBefore.toISOString()}`, {
    method: "DELETE",
  });
  assert(res.status === 400, "Reject before in future with 400");

  // Test successful expired delete call (even if 0 items)
  const pastBefore = new Date(Date.now() - 60 * 1000);
  res = await fetch(`${BASE_URL}/api/bookings/expired?roomId=${room1.id}&before=${pastBefore.toISOString()}`, {
    method: "DELETE",
  });
  const expiredRes = await res.json();
  assert(res.status === 200 && expiredRes.deletedCount !== undefined, "Delete expired bookings succeeds with 200 and deletedCount");

  console.log("\n======================================");
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("======================================");

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
