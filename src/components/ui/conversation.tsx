'use client';

import { Button } from '@/components/ui/button';
import { ArrowDownIcon } from 'lucide-react';
import { useRef, useCallback, useState, useEffect, type ComponentProps, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ConversationProps = HTMLAttributes<HTMLDivElement>;

export const Conversation = ({ className, children, ...props }: ConversationProps) => (
  <div
    className={cn('relative flex-1 overflow-y-auto', className)}
    role="log"
    {...props}
  >
    {children}
  </div>
);

export type ConversationContentProps = HTMLAttributes<HTMLDivElement>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <div className={cn('p-4', className)} {...props} />
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button> & {
  containerRef?: React.RefObject<HTMLDivElement>;
};

export const ConversationScrollButton = ({
  className,
  containerRef,
  ...props
}: ConversationScrollButtonProps) => {
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 20);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef]);

  const handleScrollToBottom = useCallback(() => {
    containerRef?.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, [containerRef]);

  if (isAtBottom) return null;

  return (
    <Button
      className={cn(
        'absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full',
        className,
      )}
      onClick={handleScrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};
