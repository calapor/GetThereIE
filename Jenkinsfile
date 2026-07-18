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
  containers:
    - name: node
      image: node:22-bookworm
      command: ["sleep"]
      args: ["infinity"]
      resources:
        requests: { cpu: "250m", memory: "512Mi" }
        limits:   { cpu: "2",    memory: "2Gi" }

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
      resources:
        # ephemeral-storage routes the agent onto a node with enough free disk.
        # The vfs driver copies every layer in full; Next.js + pnpm store need
        # several GB. Without this the pod can land on a nearly-full Pi node.
        requests: { cpu: "250m", memory: "512Mi", ephemeral-storage: "12Gi" }
        limits:   { cpu: "2",    memory: "3Gi" }
'''
    }
  }

  options {
    disableConcurrentBuilds()
    timeout(time: 60, unit: 'MINUTES')
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
          sh 'pnpm run build'
        }
      }
    }

    stage('Build & push image') {
      when {
        expression { env.GIT_BRANCH?.endsWith('/main') }
      }
      steps {
        container('buildah') {
          sh '''
            buildah --storage-driver vfs rm --all || true
            buildah --storage-driver vfs rmi --prune || true
          '''
          sh '''
            buildah --storage-driver vfs bud --isolation chroot \
              -f Dockerfile \
              --build-arg "APP_VERSION=${IMAGE_TAG} (#${BUILD_NUMBER})" \
              -t "${REGISTRY}/${IMAGE_REPO}/web:${IMAGE_TAG}" \
              -t "${REGISTRY}/${IMAGE_REPO}/web:main" .
            for tag in "${IMAGE_TAG}" main; do
              buildah --storage-driver vfs push --tls-verify=false \
                "${REGISTRY}/${IMAGE_REPO}/web:${tag}" \
                "docker://${REGISTRY}/${IMAGE_REPO}/web:${tag}"
            done
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
          sh '''
            helm upgrade --install bustracker deploy/helm/bustracker \
              --namespace "${NAMESPACE}" --create-namespace \
              --set image.registry="${REGISTRY}" \
              --set image.repository="${IMAGE_REPO}" \
              --set image.tag="${IMAGE_TAG}" \
              --wait --timeout 60m
          '''
        }
      }
    }

  }

  post {
    always {
      container('buildah') {
        sh '''
          buildah --storage-driver vfs rm --all || true
          buildah --storage-driver vfs rmi --all || true
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
