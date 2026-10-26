import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 16
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Compute 5-window range of pages matching screenshot style
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = startPage + maxButtons - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  const pages: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const handleSelect = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== currentPage) {
      onPageChange(p);
    }
  };

  return (
    <div className="my-8 flex flex-col items-center gap-3 select-none">
      {/* Pagination Buttons matching user screenshot style */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 max-w-full px-2">
        
        {/* First Button (if not on first range) */}
        {startPage > 1 && (
          <button
            type="button"
            onClick={() => handleSelect(1)}
            aria-label="First page"
            className="h-11 sm:h-12 min-w-[54px] px-3.5 rounded-[12px] sm:rounded-[14px] bg-[#cfd4dc] hover:bg-[#c2c8d2] text-[#1f2937] dark:bg-[#2c2c2c] dark:hover:bg-[#383838] dark:text-[#f3f4f6] text-[15px] sm:text-[16px] font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center"
          >
            First
          </button>
        )}

        {/* Prev Button */}
        {currentPage > 1 && (
          <button
            type="button"
            onClick={() => handleSelect(currentPage - 1)}
            aria-label="Previous page"
            className="h-11 sm:h-12 min-w-[54px] px-3.5 rounded-[12px] sm:rounded-[14px] bg-[#cfd4dc] hover:bg-[#c2c8d2] text-[#1f2937] dark:bg-[#2c2c2c] dark:hover:bg-[#383838] dark:text-[#f3f4f6] text-[15px] sm:text-[16px] font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center"
          >
            Prev
          </button>
        )}

        {/* Numbered Page Buttons */}
        {pages.map((p) => {
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => handleSelect(p)}
              aria-label={`Page ${p}`}
              aria-current={isActive ? 'page' : undefined}
              className={`h-11 w-11 sm:h-12 sm:w-12 rounded-[12px] sm:rounded-[14px] text-[17px] sm:text-[18px] font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center ${
                isActive
                  ? 'bg-[#ea580c] text-white shadow-orange-500/20'
                  : 'bg-[#cfd4dc] hover:bg-[#c2c8d2] text-[#1f2937] dark:bg-[#2c2c2c] dark:hover:bg-[#383838] dark:text-[#f3f4f6]'
              }`}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button */}
        {currentPage < totalPages && (
          <button
            type="button"
            onClick={() => handleSelect(currentPage + 1)}
            aria-label="Next page"
            className="h-11 sm:h-12 min-w-[54px] px-3.5 rounded-[12px] sm:rounded-[14px] bg-[#cfd4dc] hover:bg-[#c2c8d2] text-[#1f2937] dark:bg-[#2c2c2c] dark:hover:bg-[#383838] dark:text-[#f3f4f6] text-[15px] sm:text-[16px] font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center"
          >
            Next
          </button>
        )}

        {/* Last Button */}
        {endPage < totalPages && (
          <button
            type="button"
            onClick={() => handleSelect(totalPages)}
            aria-label="Last page"
            className="h-11 sm:h-12 min-w-[54px] px-3.5 rounded-[12px] sm:rounded-[14px] bg-[#cfd4dc] hover:bg-[#c2c8d2] text-[#1f2937] dark:bg-[#2c2c2c] dark:hover:bg-[#383838] dark:text-[#f3f4f6] text-[15px] sm:text-[16px] font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center"
          >
            Last
          </button>
        )}

      </div>
    </div>
  );
}
