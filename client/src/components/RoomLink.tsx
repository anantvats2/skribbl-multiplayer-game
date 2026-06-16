import { useEffect, useRef } from "react";
import { useRoom } from "../context/RoomContext";
import { LinkIcon } from "lucide-react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import Button from "./ui/Button";
import clsx from "clsx";

const RoomLink = ({ className }: { className?: string }) => {
  const shiftPressed = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        shiftPressed.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        shiftPressed.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const { roomId: contextRoomId } = useRoom();
  const roomId =
    contextRoomId ||
    sessionStorage.getItem("sketchbattle_invite_roomId") ||
    "";

  function handleCopy() {
    const textToCopy = `${window.location.origin}/?roomId=${roomId}`;
    console.log("[INVITE] Invite URL copied with roomId:", roomId || "(empty)");

    if (shiftPressed.current) {
      window.open(textToCopy, "_blank");
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).catch((err) => {
        console.error("Clipboard access denied:", err);
      });
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }
      document.body.removeChild(textarea);
    }
  }

  return (
    <Tippy
      content="Copied!"
      placement="bottom"
      trigger="click"
      animation="tada"
    >
      <Button
        onClick={handleCopy}
        variant="info"
        className={clsx(
          "w-full sm:w-auto rounded-3xl px-5 py-3 text-base font-semibold shadow-lg shadow-cyan-500/10 transition duration-200 hover:-translate-y-0.5 hover:shadow-cyan-500/20",
          className
        )}
        startIcon={<LinkIcon className="w-4 h-4 inline-block mr-2" />}
      >
        Invite
      </Button>
    </Tippy>
  );
};

export default RoomLink;
