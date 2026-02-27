// /**
//  * socket-service.ts
//  * วางที่: services/socket-service.ts
//  * npm install socket.io-client
//  *
//  * ใช้ร่วมกัน Head1 (connector 1) + Head2 (connector 2)
//  */
// import { io, Socket } from "socket.io-client";

// const SOCKET_URL = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
// let socket: Socket | null = null;

// export function connectSocket(userId: string): Socket {
//   if (socket?.connected) return socket;
//   socket = io(SOCKET_URL, {
//     auth: { userId },
//     transports: ["websocket", "polling"],
//     reconnection: true,
//     reconnectionAttempts: 10,
//     reconnectionDelay: 3000,
//   });
//   socket.on("connect", () => console.log("✅ Socket.IO connected:", socket?.id));
//   socket.on("disconnect", (r) => console.log("⚠️ Socket.IO disconnected:", r));
//   socket.on("connect_error", (e) => console.error("❌ Socket.IO error:", e.message));
//   return socket;
// }

// export function disconnectSocket() { socket?.disconnect(); socket = null; }
// export function getSocket(): Socket | null { return socket; }
// export function isConnected(): boolean { return socket?.connected ?? false; }
// export function joinSession(sessionId: string) { socket?.emit("joinSession", { sessionId }); }
// export function leaveSession(sessionId: string) { socket?.emit("leaveSession", { sessionId }); }

// // ===== Types =====
// export interface ChargingStartedData {
//   sessionId: string; connectorId: number; transactionId: number; state: string;
// }
// export interface MeterUpdateData {
//   sessionId: string; connectorId: number; soc: number; powerKw: number;
//   energyCharged: number; chargingTime: number; totalPrice: number;
//   carbonReduce: number; voltage: number; currentA: number; timestamp: string;
// }
// export interface ChargingStoppedData {
//   sessionId: string; connectorId: number; energyCharged: number;
//   chargingTime: number; totalPrice: number; carbonReduce: number; reason: string;
// }
// export interface ConnectorStatusData {
//   cpId: string; connectorId: number; status: string; errorCode: string;
// }

// // ===== Listeners (return cleanup) =====
// export function onChargingStarted(cb: (d: ChargingStartedData) => void) {
//   socket?.on("chargingStarted", cb);
//   return () => { socket?.off("chargingStarted", cb); };
// }
// export function onMeterUpdate(cb: (d: MeterUpdateData) => void) {
//   socket?.on("meterUpdate", cb);
//   return () => { socket?.off("meterUpdate", cb); };
// }
// export function onChargingStopped(cb: (d: ChargingStoppedData) => void) {
//   socket?.on("chargingStopped", cb);
//   return () => { socket?.off("chargingStopped", cb); };
// }
// export function onChargingFaulted(cb: (d: any) => void) {
//   socket?.on("chargingFaulted", cb);
//   return () => { socket?.off("chargingFaulted", cb); };
// }
// export function onConnectorStatus(cb: (d: ConnectorStatusData) => void) {
//   socket?.on("connectorStatus", cb);
//   return () => { socket?.off("connectorStatus", cb); };
// }