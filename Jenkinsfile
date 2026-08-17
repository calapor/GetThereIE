pipeline {
  agent {
    kubernetes {
      defaultContainer 'node'
      yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  securityContext:
    fsGroup: 1000
  volumes:
    - name: buildah-storage
      emptyDir:
        sizeLimit: 12Gi
  containers:
    - name: node
      image: node:22-bookworm
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "250m", memory: "512Mi", ephemeral-storage: "2Gi" }
        limits:   { cpu: "2",    memory: "2Gi",   ephemeral-storage: "4Gi" }

    - name: helm
      image: alpine/helm:3.16.3
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "50m",  memory: "64Mi" }
        limits:   { cpu: "500m", memory: "256Mi" }

    - name: buildah
      image: quay.io/buildah/stable:v1.37.5
      command: ["sleep"]
      args: ["infinity"]
      securityContext:
        privileged: true
      volumeMounts:
        - name: buildah-storage
          mountPath: /var/lib/containers
      resources:
        # overlay driver: CoW layers, ~4-4.5 GB peak (vs ~9.5 GB for vfs).
        # ephemeral-storage routes the pod onto a node with enough free disk.
        requests: { cpu: "250m", memory: "512Mi", ephemeral-storage: "6Gi" }
        limits:   { cpu: "2",    memory: "3Gi",   ephemeral-storage: "12Gi" }
'''
    }
  }

  options {
    disableConcurrentBuilds()
    timeout(time: 120, unit: 'MINUTES')
  }

  environment {
    REGISTRY   = '192.168.1.101:30500'
    IMAGE_REPO = 'bustracker'
    NAMESPACE  = 'bustracker'
  }

  stages {

    stage('Setup') {
      steps {
        container('node') {
          sh 'git config --global --add safe.directory "$WORKSPACE"'

          script {
            env.IMAGE_TAG = sh(
              returnStdout: true,
              script: 'git rev-parse --short HEAD'
            ).trim()
          }

          sh 'corepack enable && corepack prepare pnpm@11.1.1 --activate'
        }
      }
    }

    stage('Install') {
      steps {
        container('node') {
          sh 'pnpm install --frozen-lockfile'
        }
      }
    }

    stage('Verify') {
      steps {
        container('node') {
          sh 'pnpm run lint'
          sh 'pnpm run typecheck'
          sh 'pnpm test'
        }
      }
    }

    stage('Build & push image') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') }
      }
      options {
        timeout(time: 60, unit: 'MINUTES')
      }
      steps {
        container('buildah') {
          sh '''
            BUILDAH="buildah --root /var/lib/containers/storage --storage-driver overlay"

            echo "=== Storage before build ==="
            df -h /var/lib/containers || true
            du -sh /var/lib/containers || true

            echo "=== Cleanup any stale state ==="
            $BUILDAH rm --all || true
            $BUILDAH rmi --all --force || true

            echo "=== Storage after cleanup ==="
            df -h /var/lib/containers || true

            echo "=== Building image ==="
            export TMPDIR=/var/lib/containers/tmp && mkdir -p "$TMPDIR"
            $BUILDAH bud --isolation chroot \
              -f Dockerfile \
              --build-arg "APP_VERSION=${IMAGE_TAG} (#${BUILD_NUMBER})" \
              -t "${REGISTRY}/${IMAGE_REPO}/web:${IMAGE_TAG}" \
              -t "${REGISTRY}/${IMAGE_REPO}/web:main" .

            echo "=== Pushing image ==="
            for tag in "${IMAGE_TAG}" main; do
              pushed=false
              for attempt in 1 2 3; do
                echo "=== Push ${tag} attempt ${attempt}/3 ==="
                if timeout 20m $BUILDAH push --tls-verify=false \
                  "${REGISTRY}/${IMAGE_REPO}/web:${tag}" \
                  "docker://${REGISTRY}/${IMAGE_REPO}/web:${tag}"; then
                  pushed=true
                  break
                fi
                [ "$attempt" -lt 3 ] && echo "Push stalled, retrying in 20s..." && sleep 20
              done
              $pushed || { echo "Push failed for ${tag} after 3 attempts"; exit 1; }
            done

            echo "=== Full prune after push ==="
            $BUILDAH rm --all || true
            $BUILDAH rmi --all --force || true

            echo "=== Storage after prune ==="
            df -h /var/lib/containers || true
            du -sh /var/lib/containers || true
          '''
        }
      }
    }

    stage('Deploy') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') }
      }
      steps {
        container('helm') {
          withCredentials([string(credentialsId: 'nta-api-key', variable: 'NTA_API_KEY')]) {
            sh '''
              helm upgrade --install bustracker deploy/helm/bustracker \
                --namespace "${NAMESPACE}" --create-namespace \
                --set image.registry="${REGISTRY}" \
                --set image.repository="${IMAGE_REPO}" \
                --set image.tag="${IMAGE_TAG}" \
                --set ntaApiKey="${NTA_API_KEY}" \
                --wait --atomic --cleanup-on-fail --timeout 15m
            '''
          }
        }
      }
    }

  }

  post {
    always {
      container('buildah') {
        sh '''
          BUILDAH="buildah --root /var/lib/containers/storage --storage-driver overlay"
          $BUILDAH rm --all || true
          $BUILDAH rmi --all --force || true
        '''
      }
    }

    success {
      echo "Deployed bustracker @ ${env.IMAGE_TAG}"
    }

    failure {
      echo "Pipeline failed for bustracker @ ${env.IMAGE_TAG}"
    }
  }
}
