package com.portfolioplanner.service;

import com.portfolioplanner.domain.model.BauAssumption;
import com.portfolioplanner.domain.model.Pod;
import com.portfolioplanner.domain.repository.BauAssumptionRepository;
import com.portfolioplanner.domain.repository.PodRepository;
import com.portfolioplanner.dto.request.BauAssumptionRequest;
import com.portfolioplanner.dto.response.BauAssumptionResponse;
import com.portfolioplanner.exception.ResourceNotFoundException;
import com.portfolioplanner.mapper.EntityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BauAssumptionService {

    private final BauAssumptionRepository bauRepository;
    private final PodRepository podRepository;
    private final EntityMapper mapper;

    public List<BauAssumptionResponse> getAll() {
        return mapper.toBauResponseList(bauRepository.findAll());
    }

    public List<BauAssumptionResponse> getByPod(Long podId) {
        return mapper.toBauResponseList(bauRepository.findByPodId(podId));
    }

    @Transactional
    @CacheEvict(value = "calculations", allEntries = true)
    public List<BauAssumptionResponse> bulkUpdate(List<BauAssumptionRequest> requests) {
        List<BauAssumption> results = new ArrayList<>();

        for (BauAssumptionRequest req : requests) {
            Pod pod = podRepository.findById(req.podId())
                    .orElseThrow(() -> new ResourceNotFoundException("Pod", req.podId()));

            BauAssumption bau = bauRepository.findByPodIdAndRole(req.podId(), req.role())
                    .orElseGet(() -> {
                        BauAssumption newBau = new BauAssumption();
                        newBau.setPod(pod);
                        newBau.setRole(req.role());
                        return newBau;
                    });

            bau.setBauPct(req.bauPct());
            results.add(bauRepository.save(bau));
        }

        return mapper.toBauResponseList(results);
    }
}
