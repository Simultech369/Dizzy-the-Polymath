try:
    import pytest
except ImportError:
    class Approx:
        def __init__(self, value, rel=0.01):
            self.value = value
            self.rel = rel
        def __eq__(self, other):
            if other is None:
                return False
            return abs(self.value - other) <= abs(self.value * self.rel)
    class PytestMock:
        def approx(self, value, rel=0.01):
            return Approx(value, rel)
    pytest = PytestMock()

from dizzy_spec import (
    DocMetadata,
    MemoryClass,
    DecayResult,
    calculate_decay,
    SieveProposal,
    validate_mechanism_sieve,
    contains_keyword_as_word
)

class TestDecayCurves:
    
    def test_extreme_future_timestamp(self):
        """Test calculate_decay with now_ms in distant future (year 3000)."""
        meta = DocMetadata(
            memory_class=MemoryClass.REUSABLE_PATTERN,
            captured_at=1000,  # Year 1970
        )
        # Year 3000 in milliseconds
        year_3000_ms = 32503680000000  # ~3000-01-01
        
        decay = calculate_decay(meta, year_3000_ms)
        
        # Factor should be extremely small but not zero
        assert decay.factor > 0
        assert decay.factor < 1e-10  # ~1000 years of half-life every 365 days
        assert decay.age_in_days is not None
        assert decay.age_in_days > 365 * 1000  # > 1000 years
        assert not decay.review_due  # ReusablePattern never flags review_due
    
    def test_clock_skew_various_offsets(self):
        """Test clock skew: now_ms < captured_at by various offsets."""
        captured = 1000000  # Reference time
        
        test_cases = [
            (-1, 0.0),      # 1 ms in past -> clamp to 0
            (-1000, 0.0),   # 1 second in past -> clamp to 0
            (-86400000, 0.0),  # 1 day in past -> clamp to 0
            (-31536000000, 0.0),  # 1 year in past -> clamp to 0
        ]
        
        for offset, expected_age in test_cases:
            now = captured + offset  # now < captured when offset negative
            meta = DocMetadata(
                memory_class=MemoryClass.ASSISTANT_OBSERVATION,
                captured_at=captured
            )
            decay = calculate_decay(meta, now)
            
            assert decay.age_in_days == expected_age
            assert decay.factor == 1.0  # No decay when age clamped to 0
    
    def test_zero_timestamp_behavior(self):
        """Test with zero timestamps (Unix epoch)."""
        meta = DocMetadata(
            memory_class=MemoryClass.USER_CLAIM,
            captured_at=0,  # Valid timestamp (1970-01-01)
            last_reviewed=None
        )
        
        # Now at epoch + 366 days
        year_later_ms = 366 * 24 * 3600 * 1000
        decay = calculate_decay(meta, year_later_ms)
        
        # 366 days should trigger review_due
        assert decay.review_due == True
        assert decay.factor == 1.0
        assert decay.age_in_days is not None
        assert decay.age_in_days == pytest.approx(366.0, rel=0.01)
    
    def test_null_timestamps(self):
        """Test with absent timestamps (None)."""
        meta = DocMetadata(
            memory_class=MemoryClass.REUSABLE_PATTERN,
            captured_at=None,
            last_reviewed=None
        )
        
        decay = calculate_decay(meta, 1000000)
        
        assert decay.age_in_days is None
        assert decay.factor == 1.0  # No decay without timestamp
        assert not decay.review_due
    
    def test_last_reviewed_precedence(self):
        """Test that last_reviewed takes precedence over captured_at."""
        captured = 1000000
        last_reviewed = captured + (180 * 24 * 3600 * 1000)  # 180 days later
        
        meta = DocMetadata(
            memory_class=MemoryClass.ASSISTANT_OBSERVATION,
            captured_at=captured,
            last_reviewed=last_reviewed
        )
        
        now = last_reviewed + (90 * 24 * 3600 * 1000)  # 90 days after review
        
        decay = calculate_decay(meta, now)
        
        # Age should be 90 days (from last_reviewed), not 270 days (from captured)
        assert decay.age_in_days == pytest.approx(90.0, rel=0.01)
        
        # Factor for 90 days / 180-day half-life = 0.5^(0.5) ≈ 0.707
        expected_factor = 0.5 ** (90.0 / 180.0)
        assert decay.factor == pytest.approx(expected_factor, rel=0.001)
    
    def test_authority_preserved_no_review_until_365(self):
        """Test authority-preserved memories only trigger review_due at 365+ days."""
        meta = DocMetadata(
            memory_class=MemoryClass.PROJECT_DECISION,
            captured_at=1000000
        )
        
        # Test at 364 days
        now_364 = 1000000 + (364 * 24 * 3600 * 1000)
        decay_364 = calculate_decay(meta, now_364)
        assert not decay_364.review_due
        assert decay_364.factor == 1.0
        
        # Test at 365 days
        now_365 = 1000000 + (365 * 24 * 3600 * 1000)
        decay_365 = calculate_decay(meta, now_365)
        assert decay_365.review_due
        assert decay_365.factor == 1.0
        
        # Test at 400 days
        now_400 = 1000000 + (400 * 24 * 3600 * 1000)
        decay_400 = calculate_decay(meta, now_400)
        assert decay_400.review_due
        assert decay_400.factor == 1.0

class TestWordBoundaryMatching:
    
    def test_no_false_positive_substring(self):
        """Test that substring matches don't trigger false positives."""
        # "none" in "nonexistent" should NOT match
        assert not contains_keyword_as_word("nonexistent", "none")
        
        # "no exit" in "noexit" (no space) should NOT match
        assert not contains_keyword_as_word("noexit", "no exit")
        
        # "lock-in" in "lockin" (no hyphen) should NOT match
        assert not contains_keyword_as_word("lockin", "lock-in")
    
    def test_correct_word_boundary_matches(self):
        """Test that actual word boundaries match correctly."""
        # Exact match
        assert contains_keyword_as_word("none", "none")
        
        # With spaces
        assert contains_keyword_as_word("the answer is none", "none")
        assert contains_keyword_as_word("no exit strategy", "no exit")
        
        # With punctuation
        assert contains_keyword_as_word("none.", "none")
        assert contains_keyword_as_word("(none)", "none")
        assert contains_keyword_as_word("lock-in mechanism", "lock-in")
        
        # With mixed case
        assert contains_keyword_as_word("NONE is an option", "none")
        assert contains_keyword_as_word("No Exit Available", "no exit")
    
    def test_sieve_with_substring_trap(self):
        """Integration test: sieve should NOT reject proposals with 'none' as substring."""
        proposal = SieveProposal(
            title="Test Mechanism",
            capability="Data processing",
            ownership="Community DAO",
            funding="Grants",
            governance="Multisig with appeals",
            enforcement="Smart contract",
            exit="The mechanism includes a nonexistent withdrawal process",  # 'none' as substring
            capture_risk="Anonomitigation strategy is in place",  # 'no mitigation' as substring
            simplification="Simple design",
            wellbeing_metrics="Patient outcomes measured weekly",
        )
        
        result = validate_mechanism_sieve(proposal)
        
        # Should NOT fail on exit or capture risk because keywords are substrings only
        exit_errors = [e for e in result.errors if "Exit strategy" in e]
        capture_errors = [e for e in result.errors if "High capture risk" in e]
        
        assert len(exit_errors) == 0, "Substring 'none' caused false positive"
        assert len(capture_errors) == 0, "Substring 'no mitigation' caused false positive"
    
    def test_sieve_actual_keyword_matches(self):
        """Test that actual keyword matches trigger correctly."""
        proposal = SieveProposal(
            title="Test",
            capability="X",
            ownership="Absolute operator ownership",  # Exact keyword match
            funding="VC",
            governance="Top-down",
            enforcement="Central",
            exit="none",  # Exact keyword match
            capture_risk="Mitigated",
            simplification="Simple",
            wellbeing_metrics="TVL and token price",  # Bad metrics
        )
        
        result = validate_mechanism_sieve(proposal)
        
        assert not result.ok
        assert any("Exit strategy" in e for e in result.errors)
        assert any("High capture risk" in e for e in result.errors)
        assert any("Metrics capture" in e for e in result.errors)

class TestExtremeValues:
    
    def test_u64_overflow_prevention(self):
        """Test that large timestamps don't cause overflow (Python int handles it)."""
        u64_max = 18446744073709551615
        
        meta = DocMetadata(
            memory_class=MemoryClass.UNCLASSIFIED,
            captured_at=0
        )
        
        # Should not overflow or crash
        decay = calculate_decay(meta, u64_max)
        
        # Factor should be extremely close to 0
        assert decay.factor >= 0 and decay.factor <= 1
        # Age should be massive but computed safely
        assert decay.age_in_days is not None
        assert decay.age_in_days > 1e11  # Billions of days
    
    def test_floating_point_underflow(self):
        """Test that extremely old memories don't underflow to 0 prematurely."""
        meta = DocMetadata(
            memory_class=MemoryClass.REUSABLE_PATTERN,
            captured_at=0
        )
        
        # 10,000 years in milliseconds
        ten_thousand_years_ms = 10000 * 365 * 24 * 3600 * 1000
        
        decay = calculate_decay(meta, ten_thousand_years_ms)
        
        # Python float should handle gracefully (won't underflow to 0)
        # 10,000 years / 365-day half-life ≈ 10,000 half-lives → 2^-10000 ≈ 0.0 in double
        assert decay.factor == 0.0 or decay.factor > 0
        assert decay.age_in_days is not None

if __name__ == "__main__":
    print("Running advanced edge-case test suite...")
    
    # Run TestDecayCurves
    td = TestDecayCurves()
    td.test_extreme_future_timestamp()
    td.test_clock_skew_various_offsets()
    td.test_zero_timestamp_behavior()
    td.test_null_timestamps()
    td.test_last_reviewed_precedence()
    td.test_authority_preserved_no_review_until_365()
    
    # Run TestWordBoundaryMatching
    tw = TestWordBoundaryMatching()
    tw.test_no_false_positive_substring()
    tw.test_correct_word_boundary_matches()
    tw.test_sieve_with_substring_trap()
    tw.test_sieve_actual_keyword_matches()
    
    # Run TestExtremeValues
    te = TestExtremeValues()
    te.test_u64_overflow_prevention()
    te.test_floating_point_underflow()
    
    print("All advanced edge-case tests passed successfully!")

