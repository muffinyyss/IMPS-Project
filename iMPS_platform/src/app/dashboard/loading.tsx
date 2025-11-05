export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/5">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
    </div>
  );
}

// export default function Loading() {
//   return (
//     <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/5">
//       <div className="flex items-center gap-3" role="status" aria-live="polite" aria-busy="true">
//         <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
//         <span className="text-sm text-gray-600">Loading…</span>
//       </div>
//     </div>
//   );
// }
