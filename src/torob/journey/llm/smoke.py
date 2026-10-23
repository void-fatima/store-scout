"""Manually opt in: python -m torob.journey.llm.smoke --live."""

import argparse
import getpass
import os
import sys
import warnings
from collections.abc import Sequence

from .client import BoxAPIClient, OutputLimitParameter
from .config import LLMConfig
from .errors import LLMError

SMOKE_PROMPT = "لطفاً فقط بنویس: سلام"
SMOKE_MAX_OUTPUT_TOKENS = 64


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Offline by default; --live may consume API credit."
    )
    parser.add_argument("--live", action="store_true", help="Make exactly one provider request.")
    parser.add_argument(
        "--output-limit-parameter",
        choices=[parameter.value for parameter in OutputLimitParameter],
        help="Select only after verifying this parameter is supported by your chosen model.",
    )
    args = parser.parse_args(argv)
    if not args.live:
        print("Offline: no provider request performed. Use --live to opt in to one paid request.")
        return 0

    # Only the CLI may prompt. Production configuration never imports or invokes this helper.
    interactive = sys.stdin.isatty() and sys.stderr.isatty()
    env = {
        name: os.environ[name]
        for name in ("STORE_SCOUT_LLM_API_KEY", "STORE_SCOUT_LLM_BASE_URL", "STORE_SCOUT_LLM_MODEL")
        if name in os.environ
    }
    parameter = args.output_limit_parameter
    try:
        if not env.get("STORE_SCOUT_LLM_MODEL") and interactive:
            env["STORE_SCOUT_LLM_MODEL"] = input(
                "Account-accessible model ID (non-secret): "
            ).strip()
        if parameter is None and interactive:
            parameter = input(
                "Verified output-limit parameter for this model "
                "(max_tokens or max_completion_tokens): "
            ).strip()
        if parameter not in {item.value for item in OutputLimitParameter}:
            print(
                "configuration: specify --output-limit-parameter after checking model support.",
                file=sys.stderr,
            )
            return 2
        if not env.get("STORE_SCOUT_LLM_API_KEY") and interactive:
            # Refuse getpass's echoing fallback if secure terminal input is unavailable.
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                env["STORE_SCOUT_LLM_API_KEY"] = getpass.getpass("BoxAPI key (hidden): ")
        config = LLMConfig.from_env(env)
        BoxAPIClient(config).complete(
            SMOKE_PROMPT,
            output_limit_parameter=OutputLimitParameter(parameter),
            max_output_tokens=SMOKE_MAX_OUTPUT_TOKENS,
        )
    except LLMError as exc:
        print(f"{exc.code.value}: {exc}", file=sys.stderr)
        return 1
    except (EOFError, KeyboardInterrupt, getpass.GetPassWarning):
        print("Local smoke test cancelled or secure terminal input unavailable.", file=sys.stderr)
        return 2
    print("Success: received a valid provider text completion from one live request.")
    # Do not print provider content, headers, credentials, or operator-supplied configuration.
    print(
        "This verifies provider connectivity only; it does not verify the shopping intent workflow."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
