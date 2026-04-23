import { useRef, useState, useEffect, useCallback } from "react";
import { FileText, ChevronDown } from "lucide-react";

interface Props {
  bodyHtml: string;
  isSubmitting: boolean;
  onConfirmReview: () => void;
}

export default function DocumentReviewStep({ bodyHtml, isSubmitting, onConfirmReview }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const percent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    setScrollPercent(Math.min(percent, 100));

    if (scrollTop + clientHeight >= scrollHeight - 20) {
      setHasScrolledToBottom(true);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // If content is short enough to not need scrolling, auto-enable
    if (el.scrollHeight <= el.clientHeight + 20) {
      setHasScrolledToBottom(true);
      setScrollPercent(100);
    }
  }, [bodyHtml]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">סקירת המסמך</h3>
            <p className="text-sm text-gray-500">שלב 1 מתוך 3 - קראו את החוזה במלואו</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>התקדמות בקריאה</span>
            <span>{scrollPercent}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${scrollPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable contract content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[60vh] overflow-y-auto p-6 sm:p-8"
      >
        <div
          className="prose prose-sm max-w-none"
          dir="rtl"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>

      {/* Bottom action */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        {!hasScrolledToBottom && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-4 animate-bounce">
            <ChevronDown size={16} />
            <span>גללו למטה כדי לקרוא את כל המסמך</span>
            <ChevronDown size={16} />
          </div>
        )}

        <button
          onClick={onConfirmReview}
          disabled={!hasScrolledToBottom || isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              שומר...
            </>
          ) : (
            "קראתי את המסמך - המשך"
          )}
        </button>
      </div>
    </div>
  );
}
